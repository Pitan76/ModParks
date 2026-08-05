import { type NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { versions, projectMembers, users } from "@/db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import { findProjectPostBySlug, findProjectPostById } from "@/lib/queries/post";
import { resolveClientIp } from "@/lib/rate-limit";
import { decideCountable } from "@/lib/download/countPolicy";
import { shouldCountOnce } from "@/lib/download/dedupe";
import { recordVersionDownload } from "@/lib/download/counter";
import { getR2PublicUrl } from "@/lib/r2";
import { checkFeatureEnabled } from "@/lib/runtime/guard";
import { auth } from "@/lib/auth";
import { validateApiKey } from "@/lib/api-auth";
import { toStringArray } from "@/lib/utils/format";
import { parseCsvParam, type DownloadPreference } from "@/lib/utils/downloadUrl";
import { recordProjectDownload } from "@/lib/services/rewardMetrics";

/** 未公開扱いのステータス（直リンクでも認可が必要） */
const RESTRICTED_STATUSES = new Set(["draft", "private"]);

/**
 * ダウンロード要求元のユーザーID（セッション or APIキー）を解決する。
 * どちらも無ければ null。
 */
async function resolveRequesterId(req: NextRequest): Promise<string | null> {
  const session = await auth();
  if (session?.user?.id) return session.user.id;

  const apiAuth = await validateApiKey(req);
  if (apiAuth.valid && apiAuth.userId) return apiAuth.userId;

  return null;
}

/**
 * ダウンロード要求元とプロジェクトの関係。
 *
 * アクセス可否とカウント除外は範囲が異なる。管理者は運営上あらゆるファイルを
 * 取得できる必要があるが、そのダウンロードは「関係者の自己ダウンロード」ではないので
 * 集計からは外さない。
 */
type Relation = {
  /** 未公開・アーカイブ済み・malicious なファイルを取得できるか（作者・メンバー・管理者） */
  canAccessRestricted: boolean;
  /** ダウンロード数の集計から除外するか（作者・メンバーのみ） */
  excludedFromCount: boolean;
  /** サイト管理者か。silent パラメータの許可判定に使う */
  isAdmin: boolean;
};

async function resolveRelation(
  db: Awaited<ReturnType<typeof getDatabase>>,
  project: { id: string; authorId: string },
  userId: string | null
): Promise<Relation> {
  if (!userId) return { canAccessRestricted: false, excludedFromCount: false, isAdmin: false };

  const dbUser = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).get();
  const isAdmin = dbUser?.role === "admin";

  if (project.authorId === userId) {
    return { canAccessRestricted: true, excludedFromCount: true, isAdmin };
  }

  const member = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, userId)))
    .get();

  if (member) return { canAccessRestricted: true, excludedFromCount: true, isAdmin };

  return { canAccessRestricted: isAdmin, excludedFromCount: false, isAdmin };
}

/** バージョンが絞り込み条件（ローダー / MCバージョン）に合致するか */
function matchesPreference(
  version: { loaders: string | null; mcVersions: string | null },
  pref: DownloadPreference
): boolean {
  const loaderOk = !pref.loaders?.length
    || toStringArray(version.loaders).some((l) => pref.loaders!.includes(l));
  const mcOk = !pref.mcVersions?.length
    || toStringArray(version.mcVersions).some((v) => pref.mcVersions!.includes(v));

  return loaderOk && mcOk;
}

/**
 * プロジェクトの最新（アーカイブ済みを除く）バージョンを取得する。
 * 絞り込み条件に合致するものを優先し、無ければ単純な最新版を返す。
 */
async function getLatestVersion(
  db: Awaited<ReturnType<typeof getDatabase>>,
  slug: string,
  pref: DownloadPreference
) {
  const project = await findProjectPostBySlug(db, slug);
  if (!project) return undefined;

  const candidates = await db
    .select()
    .from(versions)
    .where(and(eq(versions.projectId, project.id), isNull(versions.archivedAt)))
    .orderBy(desc(versions.createdAt))
    .all();

  return candidates.find((v) => matchesPreference(v, pref)) ?? candidates[0];
}

/** 同一IP・同一バージョンを二重に数えない窓 */
const DEDUPE_WINDOW_SEC = 10 * 60;

/**
 * ダウンロードを統計へ計上する。
 *
 * 累積カウンタは Cron が反映するため、ここでは日次バッファへ積むだけに留める。
 * 攻撃中や Bot によるアクセスは計上しないが、配布そのものは妨げない。
 *
 * 計上は配布の付随処理なので、失敗しても呼び出し元へは伝播させない。
 * 数字が欠けることより、ファイルを配れなくなることの方が害が大きい。
 */
async function countDownload(
  req: NextRequest,
  versionId: string,
  projectId: string,
  ctx: { excludedFromCount: boolean; silent: boolean }
): Promise<void> {
  const decision = decideCountable(req.headers, ctx);
  if (!decision.countable) return;

  try {
    const ip = await resolveClientIp();
    if (!await shouldCountOnce(`dl:${versionId}:${ip}`, DEDUPE_WINDOW_SEC)) return;

    await recordVersionDownload(versionId, projectId);
    // 還元の配分計算は累積カウンタから期間差分を取れないため、日次でも積む
    await recordProjectDownload(projectId);
  } catch (err) {
    console.error("[DOWNLOAD] Failed to record download:", err);
  }
}

/** GET /api/download?versionId=... | ?slug=...
 * - versionId 指定で該当バージョン、slug 指定でそのプロジェクトの最新バージョン
 * - ダウンロードカウントをインクリメント（silent=1 かつ管理者なら加算しない）
 * - R2 のファイル URL または外部URLにリダイレクト
 */
export async function GET(req: NextRequest) {
  if (!await checkFeatureEnabled("download")) {
    return NextResponse.json(
      { error: "Downloads are temporarily disabled" },
      { status: 503, headers: { "Retry-After": "3600" } }
    );
  }

  const versionIdParam = req.nextUrl.searchParams.get("versionId");
  const slug = req.nextUrl.searchParams.get("slug");
  if (!versionIdParam && !slug) {
    return NextResponse.json({ error: "Missing versionId or slug" }, { status: 400 });
  }

  try {
    const db = await getDatabase();

    // バージョンを取得
    const version = versionIdParam
      ? await db.select().from(versions).where(eq(versions.id, versionIdParam)).get()
      : await getLatestVersion(db, slug!, {
          loaders:    parseCsvParam(req.nextUrl.searchParams.get("loaders")),
          mcVersions: parseCsvParam(req.nextUrl.searchParams.get("mcVersions")),
        });

    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const versionId = version.id;

    // プロジェクトが公開されているか確認
    const project = await findProjectPostById(db, version.projectId);

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const requesterId = await resolveRequesterId(req);
    const relation = await resolveRelation(db, project, requesterId);

    // 未公開（draft/private）は作者・メンバー・管理者のみアクセス可。
    // public / unlisted は直リンクで誰でもダウンロードできる。
    if (RESTRICTED_STATUSES.has(project.visibility) && !relation.canAccessRestricted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // アーカイブ済みバージョンは公開ダウンロード不可。作者・メンバー・管理者のみ取得できる。
    if (version.archivedAt && !relation.canAccessRestricted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // スキャンで malicious 判定のファイルは配布しない。
    // 誤検知の可能性があるため、作者・メンバー・管理者は検証目的で取得できる。
    if (version.scanStatus === "malicious" && !relation.canAccessRestricted) {
      return NextResponse.json({ error: "Download blocked by security scan" }, { status: 403 });
    }

    // 管理画面からの「サイレントダウンロード」。審査・検証目的で統計を汚さずに取得する。
    // 一般利用者が silent=1 を付けてカウントを回避できないよう、管理者のみ有効。
    const silent = req.nextUrl.searchParams.get("silent") === "1" && relation.isAdmin;

    await countDownload(req, versionId, project.id, {
      excludedFromCount: relation.excludedFromCount,
      silent,
    });

    // 外部URLの場合はそのままリダイレクト、R2の場合はプレフィックスを付加
    const fileUrl = version.fileUrl.startsWith("http")
      ? version.fileUrl
      : getR2PublicUrl(version.fileUrl);

    return NextResponse.redirect(fileUrl, { status: 302 });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
