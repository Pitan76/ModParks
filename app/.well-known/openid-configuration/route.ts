/**
 * OIDC / OAuth 2.0 のディスカバリ文書。
 * 「ModParks でログイン」を実装する側は、この1本を読めば残りの URL を自動で引ける。
 */
import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/config";
import { OAUTH_SCOPES } from "@/lib/oauth/scopes";

export async function GET() {
  return NextResponse.json({
    issuer: SITE_URL,
    authorization_endpoint: `${SITE_URL}/api/oauth/authorize`,
    token_endpoint: `${SITE_URL}/api/oauth/token`,
    userinfo_endpoint: `${SITE_URL}/api/oauth/userinfo`,
    revocation_endpoint: `${SITE_URL}/api/oauth/revoke`,
    jwks_uri: `${SITE_URL}/api/oauth/jwks`,
    scopes_supported: OAUTH_SCOPES,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["ES256"],
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"],
    code_challenge_methods_supported: ["S256"],
    claims_supported: ["sub", "name", "preferred_username", "picture", "email", "email_verified"],
  }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
