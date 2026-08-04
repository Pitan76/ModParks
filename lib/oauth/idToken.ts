/**
 * OIDC の id_token 発行と公開鍵の提供。
 *
 * 「ModParks でログイン」を他サービスに置くには、相手が検証できる署名付きトークンが要る。
 * 鍵は ES256 の秘密鍵 JWK を環境変数 OAUTH_ID_TOKEN_KEY に入れておき、
 * 対応する公開鍵を JWKS エンドポイントから配る。
 */
import { SITE_URL } from "@/lib/config";

const ALG = "ES256";
const ID_TOKEN_TTL_SEC = 60 * 60;

export const OAUTH_ISSUER = SITE_URL;

type PrivateJwk = JsonWebKey & { kid?: string };

export type IdTokenClaims = {
  sub: string;
  aud: string;
  nonce?: string;
  name?: string | null;
  preferred_username?: string | null;
  picture?: string | null;
  email?: string | null;
  email_verified?: boolean;
};

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeJson(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

async function readPrivateJwk(): Promise<PrivateJwk> {
  let raw = process.env.OAUTH_ID_TOKEN_KEY;
  if (!raw) {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    raw = (env as unknown as Record<string, string>).OAUTH_ID_TOKEN_KEY;
  }
  if (!raw) throw new Error("OAUTH_ID_TOKEN_KEY is not configured");
  return JSON.parse(raw) as PrivateJwk;
}

async function importSigningKey(jwk: PrivateJwk): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

/** id_token（JWS Compact）を組み立てる */
export async function issueIdToken(claims: IdTokenClaims): Promise<string> {
  const jwk = await readPrivateJwk();
  const key = await importSigningKey(jwk);
  const now = Math.floor(Date.now() / 1000);

  const header = encodeJson({ alg: ALG, typ: "JWT", kid: jwk.kid });
  const payload = encodeJson({
    iss: OAUTH_ISSUER,
    iat: now,
    exp: now + ID_TOKEN_TTL_SEC,
    ...claims,
  });

  const signingInput = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput)
  );

  return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
}

/**
 * JWKS で配る公開鍵。
 * 秘密鍵 JWK から差分で削るのではなく、公開に必要な項目だけを明示して組み直す。
 * 削り忘れが即そのまま鍵の漏洩になるため、許可リスト側に倒している。
 */
export async function getPublicJwks() {
  const { kty, crv, x, y, kid } = await readPrivateJwk() as PrivateJwk & { crv?: string; x?: string; y?: string };
  return { keys: [{ kty, crv, x, y, kid, alg: ALG, use: "sig" }] };
}
