/**
 * 描画済みページの全世界共有ストア。
 *
 * Cache API は colo ごとに独立しているため、Cron が温めても他の colo は空のままで、
 * そこへ着いた閲覧者が SSR の CPU を払うことになる。KV は全 colo へ複製されるので、
 * Cron が 1 回描けばどこからでも読める。
 */

/** KV のキー接頭辞。設定値と同じ名前空間を使うため区別できるようにする */
const KEY_PREFIX = "html:";

/** KV 上の保持期間(秒)。温めの間隔より十分長くする */
const KV_TTL_SEC = 3600;

/**
 * 本文の実体と食い違うヘッダ。
 *
 * 本文を文字列にして入れ直すため、元の長さや圧縮方式を引き継ぐと壊れる。
 * Set-Cookie は閲覧者ごとに違うので、返す直前に付け直す。
 */
const DROPPED_HEADERS = ["set-cookie", "content-encoding", "content-length", "transfer-encoding"];

/** 応答をそのまま持てないため、本文と必要なヘッダだけを組にして入れる */
function toEnvelope(res, body) {
  const headers = {};
  for (const [name, value] of res.headers.entries()) {
    if (DROPPED_HEADERS.includes(name)) continue;
    headers[name] = value;
  }

  return { headers, body };
}

/**
 * 保存済みの応答を取り出す。無ければ null。
 *
 * KV は外部 I/O なので、読めないことを理由にページを落とさない。
 */
export async function readStoredHtml(kv, key) {
  try {
    const envelope = await kv.get(KEY_PREFIX + key, "json");
    if (!envelope) return null;

    return new Response(envelope.body, { status: 200, headers: envelope.headers });
  } catch (e) {
    console.error("[HTML-STORE] read failed:", key, e);

    return null;
  }
}

/** 描画結果を保存する。Cron からのみ呼ぶ想定（書き込み回数に上限があるため） */
export async function writeStoredHtml(kv, key, res) {
  const body = await res.text();

  await kv.put(KEY_PREFIX + key, JSON.stringify(toEnvelope(res, body)), { expirationTtl: KV_TTL_SEC });

  return body;
}
