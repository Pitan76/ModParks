/**
 * トークンエンドポイント（RFC 6749 4.1.3 / 6）。
 * authorization_code と refresh_token の2種類だけを受け付ける。
 */
import { NextResponse } from "next/server";
import { authenticateClient, findClient, readClientCredentials } from "@/lib/oauth/clients";
import { tokenError } from "@/lib/oauth/errors";
import { consumeAuthCode, issueTokens, rotateRefreshToken, type IssuedTokens } from "@/lib/oauth/tokens";
import { verifyPkceS256 } from "@/lib/oauth/crypto";
import { issueIdToken } from "@/lib/oauth/idToken";
import { buildUserClaims } from "@/lib/oauth/userClaims";
import type { OAuthClient } from "@/db/schema";

export async function POST(request: Request) {
  const form = new URLSearchParams(await request.text());
  const { clientId, clientSecret } = readClientCredentials(request, form);

  const client = await findClient(clientId);
  if (!client) return tokenError("invalid_client", "Unknown or disabled client_id");
  if (!(await authenticateClient(client, clientSecret))) return tokenError("invalid_client", "Client authentication failed");

  const grantType = form.get("grant_type");
  if (grantType === "authorization_code") return handleAuthorizationCode(client, form);
  if (grantType === "refresh_token") return handleRefreshToken(client, form);

  return tokenError("unsupported_grant_type", `Unsupported grant_type: ${grantType ?? "(missing)"}`);
}

async function handleAuthorizationCode(client: OAuthClient, form: URLSearchParams) {
  const code = form.get("code");
  const redirectUri = form.get("redirect_uri");
  if (!code || !redirectUri) return tokenError("invalid_request", "code and redirect_uri are required");

  const record = await consumeAuthCode(code);
  if (!record) return tokenError("invalid_grant", "Authorization code is invalid, expired, or already used");
  if (record.clientId !== client.id) return tokenError("invalid_grant", "Authorization code was issued to another client");
  if (record.redirectUri !== redirectUri) return tokenError("invalid_grant", "redirect_uri does not match the authorization request");

  const pkceError = await verifyPkce(record.codeChallenge, form.get("code_verifier"));
  if (pkceError) return tokenError("invalid_grant", pkceError);

  const scopes = record.scope.split(" ");
  const issued = await issueTokens({ clientId: client.id, userId: record.userId, scopes });

  return tokenResponse(issued, { userId: record.userId, clientId: client.id, scopes, nonce: record.nonce });
}

async function handleRefreshToken(client: OAuthClient, form: URLSearchParams) {
  const refreshToken = form.get("refresh_token");
  if (!refreshToken) return tokenError("invalid_request", "refresh_token is required");

  const issued = await rotateRefreshToken(refreshToken, client.id);
  if (!issued) return tokenError("invalid_grant", "Refresh token is invalid, expired, or already used");

  return tokenResponse(issued, null);
}

/** code_challenge が保存されていれば code_verifier の提示を必須にする */
async function verifyPkce(challenge: string | null, verifier: string | null): Promise<string | null> {
  if (!challenge) return null;
  if (!verifier) return "code_verifier is required";
  if (await verifyPkceS256(verifier, challenge)) return null;
  return "code_verifier does not match code_challenge";
}

type IdTokenContext = { userId: string; clientId: string; scopes: string[]; nonce: string | null };

/**
 * openid スコープがあるときだけ id_token を添える。
 * 署名鍵が未設定でも OAuth のトークン自体は返せるよう、id_token の失敗は握って続行する。
 */
async function tokenResponse(issued: IssuedTokens, idTokenCtx: IdTokenContext | null) {
  const body: Record<string, unknown> = {
    access_token: issued.accessToken,
    token_type: "Bearer",
    expires_in: issued.expiresIn,
    refresh_token: issued.refreshToken,
    scope: issued.scope,
  };

  if (idTokenCtx?.scopes.includes("openid")) {
    const claims = await buildUserClaims(idTokenCtx.userId, idTokenCtx.scopes);
    if (claims) {
      try {
        body.id_token = await issueIdToken({
          ...claims,
          aud: idTokenCtx.clientId,
          ...(idTokenCtx.nonce ? { nonce: idTokenCtx.nonce } : {}),
        });
      } catch (e) {
        console.error("Failed to issue id_token:", e);
      }
    }
  }

  return NextResponse.json(body, { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
}
