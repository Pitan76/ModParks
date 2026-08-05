import { SLICE_BUCKET_MS } from "./ddos-config.js";
import { evaluateAndTriggerDdos } from "./ddos-detect.js";

/** Isolate ごとに行を分けるための識別子。同時刻の集計が衝突しないようにする */
const ISOLATE_ID = Math.random().toString(36).substring(2);

/** メモリ上に保持するユニークIPの上限。攻撃時に際限なく増えるのを防ぐ */
const MAX_TRACKED_IPS = 1000;

/** この件数を超えたらバケット境界を待たずに書き出す */
const EARLY_FLUSH_REQUESTS = 30;

/** 早期フラッシュの最短間隔(ms) */
const EARLY_FLUSH_INTERVAL_MS = 5000;

let currentBucket = 0;
let localRequestCount = 0;
let localDownloadCount = 0;
let localBotCount = 0;
let localBotDownloadCount = 0;
let localIPs = new Set();
let localCountries = new Set();
let localSlugs = {};

let lastFlushTime = 0;

/**
 * 書き出しの直列化用チェーン。
 *
 * 以前は実行中フラグで弾いていたが、呼び出し元は既に集計値を取り出した後
 * なので、弾いた分がそのまま失われていた。順番待ちにすれば取りこぼさない。
 */
let flushChain = Promise.resolve();

const UPSERT_SLICE_SQL = `INSERT INTO ddos_slices (slice_time, isolate_id, request_count, download_count, unique_ip_count, unique_country_count, top_slug, top_slug_count, bot_count, bot_download_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(slice_time, isolate_id) DO UPDATE SET
         request_count = request_count + excluded.request_count,
         download_count = download_count + excluded.download_count,
         bot_count = bot_count + excluded.bot_count,
         bot_download_count = bot_download_count + excluded.bot_download_count,
         unique_ip_count = max(unique_ip_count, excluded.unique_ip_count),
         unique_country_count = max(unique_country_count, excluded.unique_country_count),
         top_slug = CASE WHEN excluded.top_slug_count > top_slug_count THEN excluded.top_slug ELSE top_slug END,
         top_slug_count = max(top_slug_count, excluded.top_slug_count)`;

function resetLocalStats() {
  localRequestCount = 0;
  localDownloadCount = 0;
  localBotCount = 0;
  localBotDownloadCount = 0;
  localIPs.clear();
  localCountries.clear();
  localSlugs = {};
}

/** 現在の集計値を取り出してカウンタを初期化する */
function getAndResetStats() {
  let topSlug = null;
  let topSlugCount = 0;
  for (const [slug, count] of Object.entries(localSlugs)) {
    if (count <= topSlugCount) continue;
    topSlug = slug;
    topSlugCount = count;
  }

  const stats = {
    requestCount:       localRequestCount,
    downloadCount:      localDownloadCount,
    botCount:           localBotCount,
    botDownloadCount:   localBotDownloadCount,
    uniqueIpCount:      localIPs.size,
    uniqueCountryCount: localCountries.size,
    topSlug,
    topSlugCount,
  };

  resetLocalStats();
  return stats;
}

/**
 * 集計値を D1 へ書き出し、続けて攻撃判定を実行する。
 * 判定を書き出し成功時だけに限ることで、D1 の読み込み負荷を抑えている。
 */
async function writeSlice(env, sliceTime, stats) {
  // 書き出しの失敗はリクエスト本体に影響させない
  try {
    await env.DB.prepare(UPSERT_SLICE_SQL).bind(
      sliceTime,
      ISOLATE_ID,
      stats.requestCount,
      stats.downloadCount,
      stats.uniqueIpCount,
      stats.uniqueCountryCount,
      stats.topSlug,
      stats.topSlugCount,
      stats.botCount,
      stats.botDownloadCount,
    ).run();

    console.log(`[DDOS-GUARD] Flushed stats for bucket=${sliceTime}: reqs=${stats.requestCount}, dls=${stats.downloadCount}, IPs=${stats.uniqueIpCount}, top=${stats.topSlug}(${stats.topSlugCount})`);

    await evaluateAndTriggerDdos(env, sliceTime);
  } catch (err) {
    console.error("[DDOS-GUARD] Failed to flush stats to D1:", err);
  }
}

/**
 * 書き出しを順番待ちさせる。
 *
 * 集計値はスライスごとに独立しているため、待たせても混ざらない。
 * 取り出した値を捨てないことだけを保証する。
 */
function flushIsolateStats(env, sliceTime, stats) {
  flushChain = flushChain.then(() => writeSlice(env, sliceTime, stats));
  return flushChain;
}

/** バケット境界を跨いだら、前バケットの未書き出し分を先に流す */
function rotateBucketIfNeeded(env, ctx, bucket) {
  if (currentBucket === bucket) return;

  if (localRequestCount > 0) {
    ctx.waitUntil(flushIsolateStats(env, currentBucket, getAndResetStats()));
  }
  currentBucket = bucket;
  resetLocalStats();
}

function trackDownload(url) {
  localDownloadCount++;
  const slug = url.searchParams.get("slug") || "unknown";
  localSlugs[slug] = (localSlugs[slug] || 0) + 1;
}

/**
 * リクエスト1件をメモリ上の集計へ加える。
 * cf-connecting-ip が無いリクエスト（内部呼び出しなど）は対象外。
 */
export function trackRequest(req, url, env, ctx, isDownload, isBot) {
  const ip = req.headers.get("cf-connecting-ip");
  if (!ip) return;

  const now = Date.now();
  const bucket = Math.floor(now / SLICE_BUCKET_MS) * 10;
  rotateBucketIfNeeded(env, ctx, bucket);

  if (localIPs.size < MAX_TRACKED_IPS) localIPs.add(ip);
  localCountries.add(req.headers.get("cf-ipcountry") || "XX");
  localRequestCount++;
  if (isBot) localBotCount++;

  if (isDownload) {
    trackDownload(url);
    if (isBot) localBotDownloadCount++;
  }

  // ダウンロード以外でも件数が溜まったら流す。閲覧だけが続く間に取りこぼさないため
  if (localRequestCount >= EARLY_FLUSH_REQUESTS && now - lastFlushTime >= EARLY_FLUSH_INTERVAL_MS) {
    lastFlushTime = now;
    ctx.waitUntil(flushIsolateStats(env, bucket, getAndResetStats()));
  }
}
