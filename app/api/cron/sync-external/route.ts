import { NextResponse } from "next/server";
import { getDb, getD1 } from "@/lib/db";
import { projects, userSettings } from "@/db/schema";
import { eq, isNotNull, or, lt } from "drizzle-orm";
import { syncExternalProjectDataSystem } from "@/lib/actions/project";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // 認証ヘッダーのチェック（任意：外部からの不正アクセスを防ぐためのシークレット）
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const d1 = await getD1();
    const db = getDb(d1);

    const threeDaysAgoMs = Date.now() - (3 * 24 * 60 * 60 * 1000);

    // ModrinthまたはCurseForgeと連携しており、3日以上同期されていないプロジェクトを取得（最大10件）
    // SQLite の JSONB/JSON 操作は Drizzle だと複雑になるため、全件取得してJS側でフィルタリングするアプローチを取るか、
    // もしくは raw SQL を使う必要があります。今回はシンプルに取得してフィルタします。
    // ※ プロジェクト数が増えるとパフォーマンス影響があるため、将来的にカラム分離を検討。
    const allLinkedProjects = await db
      .select()
      .from(projects)
      .where(or(isNotNull(projects.modrinthId), isNotNull(projects.curseforgeId)))
      .all();

    const projectsToSync = allLinkedProjects
      .filter(p => {
        const extObj = p.externalDownloads as Record<string, number> | undefined;
        const lastSyncedAt = extObj?.lastSyncedAt || 0;
        return lastSyncedAt < threeDaysAgoMs;
      })
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
