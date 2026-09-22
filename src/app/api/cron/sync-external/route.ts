import { NextResponse } from "next/server";
import { getDb, getD1 } from "@/lib/db";
import { posts, projects, userSettings } from "@modparks/core/db/schema";
import { eq, isNotNull, or } from "drizzle-orm";
import { toProjectPost } from "@modparks/core/queries/postRow";
import { syncExternalDownloads } from "@modparks/core/projects/externalDownloads";
import { purgeExpiredRateLimits } from "@/lib/rate-limit";
import { rollupDownloadCounts } from "@modparks/core/download/counter";
import { rollupRecentUsage } from "@/lib/usage/rollup";
import { evaluateUsageAlert } from "@/lib/usage/alert";
import { getAdminWebhookUrl } from "@/lib/usage/webhook";
import { checkCronAuth } from "@/lib/cron/auth";
import { describeError } from "@modparks/core/errors/describe";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // 認証ヘッダーのチェック（シークレット未設定なら実行しない）
    const unauthorized = checkCronAuth(request);
    if (unauthorized) return unauthorized;

    const d1 = await getD1();
    const db = getDb(d1);

    await purgeExpiredRateLimits();

    // 外部同期が失敗しても累積カウンタは反映したいので、先に済ませる
    const rolledUpDownloads = await rollupDownloadCounts(db);

    // 利用量の集計は計上済みの件数を読むため、ダウンロード反映の後に置く
    await rollupRecentUsage(db);
    const alerted = await evaluateUsageAlert(db, await getAdminWebhookUrl());

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
      return NextResponse.json({ success: true, message: "No projects to sync", rolledUpDownloads, alerted });
    }

    const results = [];
    for (const project of projectsToSync) {
      try {
        const settings = await db.query.userSettings.findFirst({ where: eq(userSettings.userId, project.authorId) });
        await syncExternalDownloads(db, project, settings?.modrinthApiKey, process.env.CURSEFORGE_FOR_STUDIOS_API_KEY);
        results.push({ id: project.id, slug: project.slug, status: "success" });
      } catch (err: unknown) {
        const reason = describeError(err);
        console.error(`[CRON] Failed to sync project ${project.id}:`, reason);
        results.push({ id: project.id, slug: project.slug, status: "error", error: reason });
      }
    }

    return NextResponse.json({ success: true, syncedCount: projectsToSync.length, rolledUpDownloads, alerted, results });
  } catch (error: unknown) {
    const reason = describeError(error);
    console.error("[CRON] Sync error:", reason);
    return NextResponse.json({ success: false, error: reason }, { status: 500 });
  }
}
