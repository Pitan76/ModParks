import type { MiddlewareHandler } from "hono";

/**
 * 変更系メソッドで、要求元が自サイトであることを確かめる（CSRF 対策）。
 *
 * hono/csrf は使わない。あちらはフォーム系の Content-Type だけを検査し、
 * application/json は素通りさせる。JSON のクロスオリジン要求は CORS の
 * プリフライトで止まるという前提に立っているが、それは「この Worker が
 * CORS を許可していない」ことに安全性を預けている。誰かが CORS を緩めた
 * 時点で JSON の変更系が無防備になるため、Content-Type に依らず検査する。
 *
 * Next の Server Action も Origin を検査しており、移設前と同じ強さに揃えている。
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * 要求元が許可するオリジンかを判定する。
 *
 * Origin が一致すれば通す。Origin を送らない環境に備え、ブラウザが付与し
 * スクリプトからは偽装できない Sec-Fetch-Site: same-origin も認める。
 * ブラウザ外のクライアントはどちらも自由に付けられるが、CSRF は被害者の
 * ブラウザが Cookie を運ぶことで成立する攻撃なので、ここで守る対象ではない。
 * @param req 受け取ったリクエスト
 * @param appOrigin 自サイトのオリジン（例: https://modparks.pitan76.net）
 */
export function isSameOriginRequest(req: Request, appOrigin: string): boolean {
  if (SAFE_METHODS.has(req.method)) return true;

  const origin = req.headers.get("origin");
  if (origin) return origin === appOrigin;

  return req.headers.get("sec-fetch-site") === "same-origin";
}

/** isSameOriginRequest を満たさない変更系の要求を 403 で落とす */
export function sameOrigin(appOrigin: (env: unknown) => string): MiddlewareHandler {
  return async (c, next) => {
    if (!isSameOriginRequest(c.req.raw, appOrigin(c.env))) return c.json({ error: "Forbidden" }, 403);

    await next();
  };
}
