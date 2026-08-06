/**
 * ddos_slices から usage_daily への増分取り込み。
 *
 * スライスは 30 分で削除されるため、日次の合計を SUM で取り直すことはできない。
 * 取り込み済みの位置を持ち、保持期間より短い間隔で差分だけを積む。
 */
import { and, eq, gt, lte, sql } from "drizzle-orm";
import { getDatabase } from "@/lib/db";
import { ddosSlices, usageDaily, usageRollupState } from "@/db/schema";

type Db = Awaited<ReturnType<typeof getDatabase>>;

const STATE_KEY = "global";
const SECONDS_PER_DAY = 86_400;

/**
 * 現在時刻からこの秒数以内のスライスは取り込まない。
 *
 * スライスは同じ時刻に対して複数の Isolate が後から加算してくる。
 * 確定を待たずに取り込むと、後続の加算を取りこぼす。
 */
const SETTLE_DELAY_SEC = 60;

/**
 * 初回や長期停止からの復帰で遡る上限。
 * 保持期間より長く遡っても行が無いので、これ以上は意味がない。
 */
const MAX_CATCHUP_SEC = 3_600;

type DayDelta = {
  day: number;
  requests: number;
  downloads: number;
  botRequests: number;
  botDownloads: number;
};

/** 取り込み位置を読む。無ければ遡れる範囲の下限から始める */
async function readWatermark(db: Db, now: number): Promise<number> {
  const row = await db
    .select({ lastSliceTime: usageRollupState.lastSliceTime })
    .from(usageRollupState)
    .where(eq(usageRollupState.stateKey, STATE_KEY))
    .get();

  const earliest = now - MAX_CATCHUP_SEC;
  if (!row) return earliest;

  // 長く止まっていた場合、消えた期間を延々と読まないよう下限で頭打ちにする
  return Math.max(row.lastSliceTime, earliest);
}

async function writeWatermark(db: Db, sliceTime: number): Promise<void> {
  const values = { stateKey: STATE_KEY, lastSliceTime: sliceTime, updatedAt: Date.now() };

  await db
    .insert(usageRollupState)
    .values(values)
    .onConflictDoUpdate({ target: usageRollupState.stateKey, set: values })
    .run();
}

/** 未取り込みのスライスを日ごとに畳む */
async function collectDeltas(db: Db, from: number, to: number): Promise<DayDelta[]> {
  return db
    .select({
      day: sql<number>`${ddosSlices.sliceTime} / ${SECONDS_PER_DAY}`,
      requests: sql<number>`coalesce(sum(${ddosSlices.requestCount}), 0)`,
      downloads: sql<number>`coalesce(sum(${ddosSlices.downloadCount}), 0)`,
      botRequests: sql<number>`coalesce(sum(${ddosSlices.botCount}), 0)`,
      botDownloads: sql<number>`coalesce(sum(${ddosSlices.botDownloadCount}), 0)`,
    })
    .from(ddosSlices)
    .where(and(gt(ddosSlices.sliceTime, from), lte(ddosSlices.sliceTime, to)))
    .groupBy(sql`${ddosSlices.sliceTime} / ${SECONDS_PER_DAY}`)
    .all();
}

/** 日次行へ加算する。行が無ければ作る */
async function applyDelta(db: Db, delta: DayDelta): Promise<void> {
  await db
    .insert(usageDaily)
    .values({
      date: delta.day,
      requests: delta.requests,
      downloads: delta.downloads,
      botRequests: delta.botRequests,
      botDownloads: delta.botDownloads,
      updatedAt: Date.now(),
    })
    .onConflictDoUpdate({
      target: usageDaily.date,
      set: {
        requests: sql`${usageDaily.requests} + ${delta.requests}`,
        downloads: sql`${usageDaily.downloads} + ${delta.downloads}`,
        botRequests: sql`${usageDaily.botRequests} + ${delta.botRequests}`,
        botDownloads: sql`${usageDaily.botDownloads} + ${delta.botDownloads}`,
        updatedAt: Date.now(),
      },
    })
    .run();
}

/**
 * 未取り込みのスライスを日次へ積む。
 *
 * 取り込み位置は加算がすべて終わってから進める。
 * 途中で失敗した場合は次回に同じ範囲をやり直すため、二重加算より取りこぼしを選ぶ
 * ——のではなく、位置を進めないことで再試行できるようにしている。
 * 加算の途中で落ちると一部が二重に入りうるが、頻度と影響の小ささから許容する。
 *
 * @returns 取り込んだリクエスト数の合計
 */
export async function rollupSliceIncrements(): Promise<number> {
  const db = await getDatabase();
  const now = Math.floor(Date.now() / 1000);
  const settled = now - SETTLE_DELAY_SEC;

  const from = await readWatermark(db, now);
  if (settled <= from) return 0;

  const deltas = await collectDeltas(db, from, settled);
  for (const delta of deltas) {
    await applyDelta(db, delta);
  }

  await writeWatermark(db, settled);
  return deltas.reduce((total, delta) => total + delta.requests, 0);
}
