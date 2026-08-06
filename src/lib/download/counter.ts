/**
 * ダウンロード計数の記録とロールアップ。
 *
 * 記録側は日次バッファへの upsert 1 回だけで済ませ、
 * versions / projects の累積カウンタは Cron がまとめて更新する。
 */
import { and, eq, gt, sql } from "drizzle-orm";
import { getDatabase } from "@/lib/db";
import { projects, versionDownloadDaily, versions } from "@/db/schema";

/** UTC 基準の epoch day */
function toEpochDay(at: Date = new Date()): number {
  return Math.floor(at.getTime() / 86_400_000);
}

/**
 * ダウンロードを日次バッファへ 1 件積む。
 *
 * 累積カウンタは即時更新しない。反映は {@link rollupDownloadCounts} が行う。
 */
export async function recordVersionDownload(versionId: string, projectId: string): Promise<void> {
  const db = await getDatabase();

  await db
    .insert(versionDownloadDaily)
    .values({ versionId, projectId, date: toEpochDay(), count: 1 })
    .onConflictDoUpdate({
      target: [versionDownloadDaily.versionId, versionDownloadDaily.date],
      set: { count: sql`${versionDownloadDaily.count} + 1` },
    })
    .run();
}

type PendingRow = {
  versionId: string;
  projectId: string;
  date: number;
  delta: number;
};

/** 未反映の差分を持つ行だけを取り出す */
async function selectPending(db: Awaited<ReturnType<typeof getDatabase>>): Promise<PendingRow[]> {
  return db
    .select({
      versionId: versionDownloadDaily.versionId,
      projectId: versionDownloadDaily.projectId,
      date: versionDownloadDaily.date,
      delta: sql<number>`${versionDownloadDaily.count} - ${versionDownloadDaily.syncedCount}`,
    })
    .from(versionDownloadDaily)
    .where(gt(versionDownloadDaily.count, versionDownloadDaily.syncedCount))
    .all();
}

/** プロジェクト単位に畳んで、同一行への UPDATE を 1 回にまとめる */
function sumByProject(rows: PendingRow[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.projectId, (totals.get(row.projectId) ?? 0) + row.delta);
  }
  return totals;
}

/**
 * 日次バッファの差分を累積カウンタへ反映する。
 *
 * 反映済み件数を行に持たせているため、途中で失敗しても再実行で二重加算にならない。
 *
 * @returns 反映した件数の合計
 */
export async function rollupDownloadCounts(): Promise<number> {
  const db = await getDatabase();
  const pending = await selectPending(db);
  if (pending.length === 0) return 0;

  for (const row of pending) {
    await db
      .update(versions)
      .set({ downloads: sql`${versions.downloads} + ${row.delta}` })
      .where(eq(versions.id, row.versionId))
      .run();
  }

  for (const [projectId, delta] of sumByProject(pending)) {
    await db
      .update(projects)
      .set({
        downloads: sql`${projects.downloads} + ${delta}`,
        totalDownloads: sql`${projects.totalDownloads} + ${delta}`,
      })
      .where(eq(projects.id, projectId))
      .run();
  }

  // 反映済みの印は必ず最後に付ける。先に付けると失敗時に差分が失われる
  for (const row of pending) {
    await db
      .update(versionDownloadDaily)
      .set({ syncedCount: sql`${versionDownloadDaily.syncedCount} + ${row.delta}` })
      .where(and(
        eq(versionDownloadDaily.versionId, row.versionId),
        eq(versionDownloadDaily.date, row.date)
      ))
      .run();
  }

  return pending.reduce((total, row) => total + row.delta, 0);
}
