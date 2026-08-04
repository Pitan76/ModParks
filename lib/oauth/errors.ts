/**
 * RFC 6749 準拠のエラー表現。
 * 認可エンドポイントは redirect_uri へ、トークンエンドポイントは JSON で返す。
 */
import { NextResponse } from "next/server";

export type OAuthErrorCode =
  | "invalid_request"
  | "invalid_client"
  | "invalid_grant"
  | "invalid_scope"
  | "unauthorized_client"
  | "unsupported_grant_type"
  | "unsupported_response_type"
  | "access_denied"
  | "server_error"
  | "invalid_token"
  | "insufficient_scope";

/** invalid_client のみ 401、その他はプロトコル上 400 が既定 */
function statusFor(error: OAuthErrorCode): number {
  if (error === "invalid_client") return 401;
  if (error === "invalid_token") return 401;
  if (error === "insufficient_scope") return 403;
  if (error === "server_error") return 500;
  return 400;
}

export function tokenError(error: OAuthErrorCode, description?: string) {
  return NextResponse.json(
    { error, ...(description ? { error_description: description } : {}) },
    { status: statusFor(error), headers: { "Cache-Control": "no-store", Pragma: "no-cache" } }
  );
}

/** Bearer トークン検証の失敗を WWW-Authenticate 付きで返す */
export function bearerError(error: OAuthErrorCode, description: string, scope?: string) {
  const parts = [`error="${error}"`, `error_description="${description}"`];
  if (scope) parts.push(`scope="${scope}"`);
  return NextResponse.json(
    { error, error_description: description },
    { status: statusFor(error), headers: { "WWW-Authenticate": `Bearer ${parts.join(", ")}` } }
  );
}

/** 認可エンドポイントで redirect_uri が確定しているときのエラー返し */
export function redirectError(redirectUri: string, error: OAuthErrorCode, state: string | null, description?: string) {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  if (description) url.searchParams.set("error_description", description);
  if (state) url.searchParams.set("state", state);
  return NextResponse.redirect(url.toString());
}
