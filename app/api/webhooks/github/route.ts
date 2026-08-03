import { NextResponse } from "next/server";
import { getDb, getD1 } from "@/lib/db";
import { posts, projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { importGithubReleaseSystem } from "@/lib/actions/github";
import { toProjectPost } from "@/lib/queries/postRow";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * このエンドポイントの署名検証は「できるときだけ」行う。
 *
 * GitHub App 経由の配信は ModParks が持つ単一のシークレットで署名されるため検証できる。
 * 一方、利用者がリポジトリ側に個別登録した従来の Webhook は
 * 運営のシークレットを知らないので署名が付かない
 * （検証するには全オーナーに同じ値を配る必要があり、配った時点で
 *   シークレットとして成立しなくなる）。
 * そのため、署名が付いていれば必ず検証し、付いていなければ従来どおり
 * 「同期のきっかけ」としてのみ扱う。
 *
 * 偽造ペイロードが送られても、取り込む内容は下で GitHub API から
 * 取り直すため改竄はできない。残るリスクは同期処理の誘発
 * （＝リソース消費）なので、リポジトリ単位のレート制限で抑える。
 */

/** 時間差から内容を推測されないよう、長さと内容を一定時間で比較する */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** x-hub-signature-256 を検証する。署名が無い場合は呼び出し側で判断する */
async function verifySignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected =
    "sha256=" +
    [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return timingSafeEqual(expected, signature);
}

export async function POST(request: Request) {
  try {
    const event = request.headers.get("x-github-event");
    if (event !== "release") {
      // 興味がないイベントは無視するが、GitHub側には正常完了を返す
      return NextResponse.json({ success: true, ignored: true, reason: "Not a release event" });
    }

    // 署名検証のために生のボディが要る
    const rawBody = await request.text();
    const signature = request.headers.get("x-hub-signature-256");
    const secret = process.env.GITHUB_WEBHOOK_SECRET;

    // 署名が付いている＝ GitHub App 経由。検証に失敗したものは受け付けない。
    if (signature) {
      if (!secret) {
        console.error("Received a signed GitHub webhook but GITHUB_WEBHOOK_SECRET is not set.");
        return NextResponse.json({ success: false, error: "Webhook secret is not configured" }, { status: 500 });
      }
      if (!(await verifySignature(rawBody, signature, secret))) {
        return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 401 });
      }
    }

    const body = JSON.parse(rawBody) as any;

    // Releaseが新しく作られた(published)、あるいは公開された場合のみ対象
    // "created", "published", "released" などがあるが、"published" が一般的な公開イベント
    if (body.action !== "published" && body.action !== "released") {
      return NextResponse.json({ success: true, ignored: true, reason: `Ignored action: ${body.action}` });
    }

    const repositoryFullName = body.repository?.full_name;
    const releaseId = body.release?.id;

    if (!repositoryFullName || !releaseId) {
      return NextResponse.json({ success: false, error: "Missing repository or release info" }, { status: 400 });
    }

    // 認証が無い以上、同じリポジトリ名で何度も叩けば同期処理を無制限に起こせる。
    // 正常な運用ではリリース公開時に数回届く程度なので、
    // リポジトリ単位で 1 時間 10 回に制限する。
    const limit = await checkRateLimit("gh-webhook", 10, 60 * 60 * 1000, repositoryFullName);
    if (!limit.success) {
      return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
    }

    const d1 = await getD1();
    const db = getDb(d1);

    // 連携されているプロジェクトを検索
    const projectRows = await db.select({ post: posts, project: projects })
      .from(projects)
      .innerJoin(posts, eq(posts.id, projects.id))
      .where(eq(projects.githubRepo, repositoryFullName))
      .all();
    const projectList = projectRows.map(({ post, project }) => toProjectPost({ posts: post, projects: project }));

    if (projectList.length === 0) {
      return NextResponse.json({ success: true, ignored: true, reason: "No matching project found" });
    }

    // 複数のプロジェクトが同じリポジトリを参照している場合は、すべて同期する
    // GitHub APIの呼び出しを削減するため、ここでReleaseを1回取得して共有する
    let prefetchedRelease: any = null;
    try {
      const { fetchGithubReleases, normalizeGithubRepo } = await import("@/lib/utils/github");
      const repo = normalizeGithubRepo(repositoryFullName);
      if (repo) {
        const all = await fetchGithubReleases(repo);
        prefetchedRelease = all.find((r) => r.id === releaseId) ?? null;
      }
    } catch (err) {
      console.error("Failed to prefetch release:", err);
      // エラー時はフォールバックとして個別に取得させる
    }

    // 非公開リポジトリの場合は上の prefetch（未認証）が失敗するため、
    // 所有者がインストールした GitHub App のトークンでプロジェクトごとに取得させる。
    const { getRepoAccessToken } = await import("@/lib/utils/githubRepoAccess");

    const results = await Promise.allSettled(
      projectList.map(async (project) => {
        const repoToken = prefetchedRelease
          ? undefined
          : await getRepoAccessToken(db, project.authorId, repositoryFullName);
        // prefetch に失敗した場合は undefined を渡して個別取得させる（null は「Release 無し」の意味になる）
        return importGithubReleaseSystem(
          db,
          project,
          releaseId,
          prefetchedRelease ?? undefined,
          repoToken
        );
      })
    );

    const hasError = results.some(r => r.status === "rejected" || (r.status === "fulfilled" && 'error' in r.value));

    if (hasError) {
      // 一部エラーがあっても、他の同期は完了している可能性があるので詳細はログ等に残す
      console.error("Some webhooks failed", results);
    }

    return NextResponse.json({ success: true, processed: projectList.length });
  } catch (e: any) {
    console.error("GitHub Webhook Error:", e);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
