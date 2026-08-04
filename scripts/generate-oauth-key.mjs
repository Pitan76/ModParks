/**
 * id_token 署名用の ES256 鍵ペアを生成する。
 *
 * 出力の1行目（秘密鍵 JWK）を OAUTH_ID_TOKEN_KEY として登録すれば、
 * 公開鍵は /api/oauth/jwks が秘密鍵から自動で導出して配る。
 *
 *   node scripts/generate-oauth-key.mjs
 */
const { privateKey } = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"]
);

const jwk = await crypto.subtle.exportKey("jwk", privateKey);

// kid は鍵の入れ替え時に世代を見分けるためのもの。年月で十分区別できる
const now = new Date();
const kid = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

console.log(JSON.stringify({ ...jwk, kid }));
