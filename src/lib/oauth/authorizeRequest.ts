/**
 * 認可リクエスト（/api/oauth/authorize と同意画面）で共通に使う検証。
 * 同意画面はユーザーの操作を挟むぶんパラメータを持ち回すため、検証をここに集約する。
 */
import { findClient, isAllowedRedirectUri } from "./clients";
import { resolveRequestedScope } from "./scopes";
import type { OAuthClient } from "@/db/schema";
import type { OAuthErrorCode } from "./errors";

export type AuthorizeParams = {
  clientId: string;
  redirectUri: string;
  scope: string | null;
  state: string | null;
  nonce: string | null;
  codeChallenge: string | null;
  codeChallengeMethod: string | null;
  prompt: string | null;
};

export type ValidatedAuthorizeRequest = {
  client: OAuthClient;
  params: AuthorizeParams;
  scopes: string[];
};

/** redirect_uri が確定する前に失敗したことを示す。ブラウザにそのまま表示するしかない */
export type AuthorizeFailure =
  | { kind: "fatal"; error: OAuthErrorCode; description: string }
  | { kind: "redirect"; redirectUri: string; error: OAuthErrorCode; description: string; state: string | null };

export function readAuthorizeParams(searchParams: URLSearchParams): AuthorizeParams & { responseType: string | null } {
  return {
    responseType: searchParams.get("response_type"),
    clientId: searchParams.get("client_id") ?? "",
    redirectUri: searchParams.get("redirect_uri") ?? "",
    scope: searchParams.get("scope"),
    state: searchParams.get("state"),
    nonce: searchParams.get("nonce"),
    codeChallenge: searchParams.get("code_challenge"),
    codeChallengeMethod: searchParams.get("code_challenge_method"),
    prompt: searchParams.get("prompt"),
  };
}

/**
 * 認可リクエストを検証する。
 * client_id / redirect_uri が信用できない段階のエラーは fatal として、
 * 攻撃者が指定した URL へ飛ばさないようにする。
 */
export async function validateAuthorizeRequest(
  searchParams: URLSearchParams
): Promise<{ ok: true; value: ValidatedAuthorizeRequest } | { ok: false; failure: AuthorizeFailure }> {
  const params = readAuthorizeParams(searchParams);

  const client = await findClient(params.clientId);
  if (!client) return fatal("invalid_client", "Unknown or disabled client_id");
  if (!params.redirectUri) return fatal("invalid_request", "redirect_uri is required");
  if (!isAllowedRedirectUri(client, params.redirectUri)) return fatal("invalid_request", "redirect_uri is not registered");

  const fail = (error: OAuthErrorCode, description: string) => ({
    ok: false as const,
    failure: { kind: "redirect" as const, redirectUri: params.redirectUri, error, description, state: params.state },
  });

  if (params.responseType !== "code") return fail("unsupported_response_type", "Only response_type=code is supported");

  const pkceError = validatePkceParams(client, params);
  if (pkceError) return fail("invalid_request", pkceError);

  const scope = resolveRequestedScope(params.scope, client.scopes.split(" "));
  if (!scope.ok) return fail("invalid_scope", `Unsupported scope: ${scope.unknown.join(" ") || "(empty)"}`);

  return { ok: true, value: { client, params, scopes: scope.scopes } };
}

/** public クライアントは PKCE 必須。confidential でも指定されたら S256 のみ受ける */
function validatePkceParams(client: OAuthClient, params: AuthorizeParams): string | null {
  if (!client.isConfidential && !params.codeChallenge) return "code_challenge is required for public clients";
  if (!params.codeChallenge) return null;
  if (params.codeChallengeMethod && params.codeChallengeMethod !== "S256") return "Only S256 code_challenge_method is supported";
  return null;
}

function fatal(error: OAuthErrorCode, description: string) {
  return { ok: false as const, failure: { kind: "fatal" as const, error, description } };
}
