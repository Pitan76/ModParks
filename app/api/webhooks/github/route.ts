import { NextResponse } from "next/server";
import { getDb, getD1 } from "@/lib/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { importGithubReleaseSystem } from "@/lib/actions/github";

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

    const d1 = await getD1();
    const db = getDb(d1);

    // 連携されているプロジェクトを検索
    const projectList = await db.select()
      .from(projects)
      .where(eq(projects.githubRepo, repositoryFullName))
      .all();

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
