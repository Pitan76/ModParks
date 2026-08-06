/**
 * OAuth で使う秘密値の生成とハッシュ。
 * DB には常にハッシュだけを置き、平文は発行レスポンスでしか外に出さない。
 */

const TOKEN_BYTES = 32;

/** SHA-256 の16進文字列。API キーの保存形式と揃えてある */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** prefix 付きのランダム秘密値。prefix は漏洩時に用途を特定するためのもの */
export function generateSecret(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return `${prefix}_${toBase64Url(bytes)}`;
}

/**
 * 長さ差から情報が漏れないように、比較前に両方をハッシュしてから突き合わせる。
 */
export async function timingSafeEqualHex(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([sha256Hex(a), sha256Hex(b)]);
  if (ha.length !== hb.length) return false;
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i);
  return diff === 0;
}

/** PKCE の code_challenge（S256）を検証する */
export async function verifyPkceS256(codeVerifier: string, challenge: string): Promise<boolean> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
  return toBase64Url(new Uint8Array(digest)) === challenge;
}
