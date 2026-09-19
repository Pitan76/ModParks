/**
 * ddos_slices から usage_daily への増分取り込み（Worker 版）。
 *
 * lib/usage/sliceRollup.ts と同じ処理を D1 の素のクエリで行う。Cron から
 * Next.js のルートを叩くと OpenNext のバンドル評価だけで Free の CPU 上限
 * (10ms) を使い切るため、この枠では本体を読み込まない。
 * 片方の仕様を変えたらもう片方も直すこと。
 */

const STATE_KEY = "global";
const SECONDS_PER_DAY = 86400;

/**
 * 現在時刻からこの秒数以内のスライスは取り込まない。
 * 同じ時刻へ複数の Isolate が後から加算してくるため、確定を待つ。
 */
const SETTLE_DELAY_SEC = 60;

/** 初回や長期停止からの復帰で遡る上限。保持期間より長く遡っても行が無い */
const MAX_CATCHUP_SEC = 3600;

/** 取り込み位置を読む。無ければ遡れる範囲の下限から始める */
async function readWatermark(db, now) {
  const row = await db.prepare(
    "SELECT last_slice_time FROM usage_rollup_state WHERE state_key = ?"
  ).bind(STATE_KEY).first();

  const earliest = now - MAX_CATCHUP_SEC;
  if (!row) return earliest;

  // 長く止まっていた場合、消えた期間を延々と読まないよう下限で頭打ちにする
  return Math.max(row.last_slice_time, earliest);
}

/** 未取り込みのスライスを日ごとに畳む */
async function collectDeltas(db, from, to) {
  const res = await db.prepare(
    `SELECT cast(slice_time / ${SECONDS_PER_DAY} as integer) AS day,
            coalesce(sum(request_count), 0)      AS requests,
            coalesce(sum(download_count), 0)     AS downloads,
            coalesce(sum(bot_count), 0)          AS bot_requests,
            coalesce(sum(bot_download_count), 0) AS bot_downloads
       FROM ddos_slices
      WHERE slice_time > ? AND slice_time <= ?
      GROUP BY day`
  ).bind(from, to).all();

  return res.results || [];
}

/** 日次行への加算と取り込み位置の更新を 1 往復にまとめる */
function buildStatements(db, deltas, settled, nowMs) {
  const statements = deltas.map((delta) => db.prepare(
    `INSERT INTO usage_daily (date, requests, downloads, bot_requests, bot_downloads, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
          requests      = usage_daily.requests + excluded.requests,
          downloads     = usage_daily.downloads + excluded.downloads,
          bot_requests  = usage_daily.bot_requests + excluded.bot_requests,
          bot_downloads = usage_daily.bot_downloads + excluded.bot_downloads,
          updated_at    = excluded.updated_at`
  ).bind(delta.day, delta.requests, delta.downloads, delta.bot_requests, delta.bot_downloads, nowMs));

  // 位置の更新は加算と同じバッチに入れる。落ちれば次回が同じ範囲をやり直す
  statements.push(db.prepare(
    `INSERT INTO usage_rollup_state (state_key, last_slice_time, updated_at)
          VALUES (?, ?, ?)
     ON CONFLICT(state_key) DO UPDATE SET
          last_slice_time = excluded.last_slice_time,
          updated_at      = excluded.updated_at`
  ).bind(STATE_KEY, settled, nowMs));

  return statements;
}

/**
 * 未取り込みのスライスを日次へ積む。
 *
 * @returns 取り込んだリクエスト数の合計
 */
async function rollupSliceIncrements(db) {
  const now = Math.floor(Date.now() / 1000);
  const settled = now - SETTLE_DELAY_SEC;

  const from = await readWatermark(db, now);
  if (settled <= from) return 0;

  const deltas = await collectDeltas(db, from, settled);
  await db.batch(buildStatements(db, deltas, settled, Date.now()));

  return deltas.reduce((total, delta) => total + delta.requests, 0);
}

/**
 * 期限切れのモードを NORMAL へ戻す。
 *
 * 判定側は期限を見て既に通常運用として振る舞っているため、これは後始末にあたる。
 * MAINTENANCE は復旧作業中であることが多く、勝手に戻ると危険なので対象外。
 * lib/runtime/mode.ts の expireModeIfDue と同じ判定。
 *
 * @returns 戻したなら true
 */
async function expireModeIfDue(kv) {
  const config = (await kv.get("app:runtime", "json")) || {};
  const state = config.mode;
  if (!state || state.mode === "NORMAL" || state.mode === "MAINTENANCE") return false;
  if (!state.until || state.until > Date.now()) return false;

  await kv.put("app:runtime", JSON.stringify({
    ...config,
    mode: { mode: "NORMAL", changedAt: Date.now() },
  }));

  return true;
}

/**
 * 10 分枠の取り込みを行う。
 *
 * D1 と KV は外部 I/O 境界。片方が落ちても他方と後続の Cron を止めない。
 */
export async function handleUsageCron(env) {
  try {
    const requests = await rollupSliceIncrements(env.DB);
    console.log(`[USAGE] Rolled up ${requests} requests`);
  } catch (e) {
    console.error("[USAGE] Rollup failed:", e);
  }

  try {
    if (await expireModeIfDue(env.SETTINGS_KV)) console.log("[USAGE] Runtime mode restored to NORMAL");
  } catch (e) {
    console.error("[USAGE] Mode expiry failed:", e);
  }
}
