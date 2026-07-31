import { NextResponse } from "next/server";
import { getDb, getD1 } from "@/lib/db";
import { posts, projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { importGithubReleaseSystem } from "@/lib/actions/github";
import { toProjectPost } from "@/lib/queries/postRow";

/**
 * GitHub からの Webhook であることを HMAC-SHA256 で検証する。
 *
 * 検証が無いと、誰でも任意のリポジトリ名を騙って同期処理を起こせる。
 * 同期される内容自体は GitHub API から取り直すため改竄はできないが、
 * DB 書き込みと GitHub API 呼び出しを無制限に誘発できてしまう。
 *
 * シークレット未設定時は受け付けない（fail-closed）。設定漏れを黙って
 * 素通しにすると、検証を入れた意味が無くなるため。
 */
async function verifyGithubSignature(rawBody: string, signature: string | null): Promise<boolean> {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return false;
  if (!signature || !signature.startsWith("sha256=")) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const actual = signature.slice("sha256=".length);

  // タイミング攻撃を避けるため、長さを見てから定数時間で比較する
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  }
  return diff === 0;
}

export async function POST(request: Request) {
  try {
    const event = request.headers.get("x-github-event");

    // 署名検証はイベント種別の判定より先に行う。
    // 未署名のリクエストに「無視した」と返すと、エンドポイントの挙動を
    // 外部から観測できてしまうため。
    const rawBody = await request.text();
    const valid = await verifyGithubSignature(rawBody, request.headers.get("x-hub-signature-256"));
    if (!valid) {
      return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 401 });
    }

    if (event !== "release") {
      // 興味がないイベントは無視するが、GitHub側には正常完了を返す
      return NextResponse.json({ success: true, ignored: true, reason: "Not a release event" });
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

    const results = await Promise.allSettled(
      projectList.map(project => importGithubReleaseSystem(db, project, releaseId, prefetchedRelease))
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
