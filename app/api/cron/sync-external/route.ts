import { NextResponse } from "next/server";
import { getDb, getD1 } from "@/lib/db";
import { posts, projects, userSettings } from "@/db/schema";
import { eq, isNotNull, or } from "drizzle-orm";
import { toProjectPost } from "@/lib/queries/postRow";
import { syncExternalProjectDataSystem } from "@/lib/actions/projectSync";
import { purgeExpiredRateLimits } from "@/lib/rate-limit";
import { checkCronAuth } from "@/lib/cron/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // 認証ヘッダーのチェック（シークレット未設定なら実行しない）
    const unauthorized = checkCronAuth(request);
    if (unauthorized) return unauthorized;

    const d1 = await getD1();
    const db = getDb(d1);

    await purgeExpiredRateLimits();

    const threeDaysAgoMs = Date.now() - (3 * 24 * 60 * 60 * 1000);

    // ModrinthまたはCurseForgeと連携しており、3日以上同期されていないプロジェクトを取得（最大10件）
    // SQLite の JSONB/JSON 操作は Drizzle だと複雑になるため、全件取得してJS側でフィルタリングするアプローチを取るか、
    // もしくは raw SQL を使う必要があります。今回はシンプルに取得してフィルタします。
    // ※ プロジェクト数が増えるとパフォーマンス影響があるため、将来的にカラム分離を検討。
    const allLinkedProjects = await db
      .select({ post: posts, project: projects })
      .from(posts)
      .innerJoin(projects, eq(projects.id, posts.id))
      .where(or(isNotNull(projects.modrinthId), isNotNull(projects.curseforgeId)))
      .all();

    const projectsToSync = allLinkedProjects
      .filter(({ project }) => {
        const extObj = project.externalDownloads as Record<string, number> | undefined;
        const lastSyncedAt = extObj?.lastSyncedAt || 0;
        return lastSyncedAt < threeDaysAgoMs;
      })
      .map(({ post, project }) => toProjectPost({ posts: post, projects: project }))
      .slice(0, 10); // 1回のCRON実行で最大10件まで（タイムアウト防止）

    if (projectsToSync.length === 0) {
      return NextResponse.json({ success: true, message: "No projects to sync" });
    }

    const results = [];
    for (const project of projectsToSync) {
      try {
        const settings = await db.query.userSettings.findFirst({ where: eq(userSettings.userId, project.authorId) });
        await syncExternalProjectDataSystem(db, project, settings);
        results.push({ id: project.id, slug: project.slug, status: "success" });
      } catch (err: any) {
        console.error(`[CRON] Failed to sync project ${project.id}:`, err);
        results.push({ id: project.id, slug: project.slug, status: "error", error: err.message });
      }
    }

    return NextResponse.json({ success: true, syncedCount: projectsToSync.length, results });
  } catch (error: any) {
    console.error("[CRON] Sync error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
