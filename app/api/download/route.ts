import { type NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { versions, projects, projectMembers, users } from "@/db/schema";
import { eq, and, sql, desc, isNull } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { getR2PublicUrl } from "@/lib/r2";
import { auth } from "@/lib/auth";
import { validateApiKey } from "@/lib/api-auth";
import { toStringArray } from "@/lib/utils/format";
import { parseCsvParam, type DownloadPreference } from "@/lib/utils/downloadUrl";

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
 * プロジェクトのインサイダー（作者・メンバー・管理者）かどうか。
 * 未公開ファイルへのアクセス可否と、ダウンロード数カウント除外の両方に使う。
 */
async function isProjectInsider(
  db: Awaited<ReturnType<typeof getDatabase>>,
  project: { id: string; authorId: string },
  userId: string | null
): Promise<boolean> {
  if (!userId) return false;
  if (project.authorId === userId) return true;

  const dbUser = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).get();
  if (dbUser?.role === "admin") return true;

  const member = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, userId)))
    .get();

  return !!member;
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
  const project = await db.select({ id: projects.id }).from(projects).where(eq(projects.slug, slug)).get();
  if (!project) return undefined;

  const candidates = await db
    .select()
    .from(versions)
    .where(and(eq(versions.projectId, project.id), isNull(versions.archivedAt)))
    .orderBy(desc(versions.createdAt))
    .all();

  return candidates.find((v) => matchesPreference(v, pref)) ?? candidates[0];
}

/** GET /api/download?versionId=... | ?slug=...
 * - versionId 指定で該当バージョン、slug 指定でそのプロジェクトの最新バージョン
 * - ダウンロードカウントをインクリメント
 * - R2 のファイル URL または外部URLにリダイレクト
 */
export async function GET(req: NextRequest) {
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
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, version.projectId))
      .get();

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const requesterId = await resolveRequesterId(req);
    const isInsider = await isProjectInsider(db, project, requesterId);

    // 未公開（draft/private）は作者・メンバー・管理者のみアクセス可。
    // public / unlisted は直リンクで誰でもダウンロードできる。
    if (RESTRICTED_STATUSES.has(project.status) && !isInsider) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // アーカイブ済みバージョンは公開ダウンロード不可。作者・メンバー・管理者のみ取得できる。
    if (version.archivedAt && !isInsider) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // スキャンで malicious 判定のファイルは配布しない。
    // 誤検知の可能性があるため、作者・メンバー・管理者は検証目的で取得できる。
    if (version.scanStatus === "malicious" && !isInsider) {
      return NextResponse.json({ error: "Download blocked by security scan" }, { status: 403 });
    }

    // ダウンロードカウントをインクリメント（M-2: 重複排除 10分間）。
    // 作者・メンバー・管理者による自己ダウンロード（テスト等）は集計から除外する。
    const rlRes = isInsider
      ? { success: false }
      : await checkRateLimit(`download:${versionId}`, 1, 10 * 60 * 1000);

    if (rlRes.success) {
      await Promise.all([
        db
          .update(versions)
          .set({ downloads: sql`${versions.downloads} + 1` })
          .where(eq(versions.id, versionId))
          .run(),
        db
          .update(projects)
          .set({ 
            downloads: sql`${projects.downloads} + 1`, 
            totalDownloads: sql`${projects.totalDownloads} + 1` 
          })
          .where(eq(projects.id, project.id))
          .run(),
      ]);
    }

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
