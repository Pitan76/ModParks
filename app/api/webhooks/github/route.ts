import { NextResponse } from "next/server";
import { getDb, getD1 } from "@/lib/db";
import { posts, projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { importGithubReleaseSystem } from "@/lib/actions/github";
import { toProjectPost } from "@/lib/queries/postRow";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * このエンドポイントは署名検証を行わない。
 *
 * Webhook を登録するのは利用者それぞれの連携先リポジトリ側であり、
 * ModParks 運営が持つ単一のシークレットでは検証できない
 * （検証するには全オーナーに同じ値を配る必要があり、配った時点で
 *   シークレットとして成立しなくなる）。
 * リポジトリ単位のシークレットを持たせるまでは、
 * ペイロードは「同期のきっかけ」としてのみ扱う。
 *
 * 偽造ペイロードが送られても、取り込む内容は下で GitHub API から
 * 取り直すため改竄はできない。残るリスクは同期処理の誘発
 * （＝リソース消費）なので、リポジトリ単位のレート制限で抑える。
 */
export async function POST(request: Request) {
  try {
    const event = request.headers.get("x-github-event");
    if (event !== "release") {
      // 興味がないイベントは無視するが、GitHub側には正常完了を返す
      return NextResponse.json({ success: true, ignored: true, reason: "Not a release event" });
    }

    const body = await request.json() as any;

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
