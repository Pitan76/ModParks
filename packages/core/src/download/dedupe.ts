/**
 * ダウンロード計数の重複排除。
 *
 * 以前は D1 のレート制限テーブルを流用していたが、判定 1 回につき D1 書き込みが
 * 1 回発生していた。重複排除は厳密さを要さない用途なので、書き込み課金の無い
 * Workers Cache API へ移す。
 *
 * 注意: Cache API はコロケーション単位で、グローバルに共有されない。
 * 同一利用者が別コロへ振られた場合は二重に数えうるが、
 * 元々 IP 単位の近似でしかないため許容する。
 */

/** キャッシュキー用の内部オリジン。実際に到達することはない */
const DEDUPE_ORIGIN = "https://dedupe.modparks.invalid";

/** Cache API が使えない環境（ローカル開発など）で警告を出しすぎないためのフラグ */
let warnedUnavailable = false;

/** @returns Workers の既定キャッシュ。利用できない環境では null */
function resolveCache(): Cache | null {
  const caches = (globalThis as { caches?: { default?: Cache } }).caches;
  if (caches?.default) return caches.default;

  if (!warnedUnavailable) {
    console.warn("[DOWNLOAD] Cache API unavailable; dedupe is disabled");
    warnedUnavailable = true;
  }
  return null;
}

/**
 * 同一キーを窓の間に 1 回だけ通す。
 *
 * 拒否ではなく「数えるかどうか」の判定であり、false を返してもダウンロード自体は継続する。
 *
 * @param key    重複排除の単位（例: バージョンID + IP）
 * @param ttlSec 同一キーを無視する秒数
 * @returns 今回を計上してよければ true
 */
export async function shouldCountOnce(key: string, ttlSec: number): Promise<boolean> {
  const cache = resolveCache();
  if (!cache) return true;

  const cacheKey = new Request(`${DEDUPE_ORIGIN}/${encodeURIComponent(key)}`);

  // キャッシュは外部I/O相当。失敗しても計数を止めず、素通ししてダウンロードを優先する
  try {
    if (await cache.match(cacheKey)) return false;

    await cache.put(
      cacheKey,
      new Response(null, { headers: { "Cache-Control": `max-age=${ttlSec}` } })
    );
    return true;
  } catch (err) {
    console.error("[DOWNLOAD] Dedupe cache error:", err);
    return true;
  }
}
