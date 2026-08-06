/**
 * 認可エンドポイント（RFC 6749 4.1）。
 * 未ログインならログインへ、同意が未取得なら同意画面へ送り、
 * 同意済みならそのまま認可コードを発行して redirect_uri に戻す。
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validateAuthorizeRequest } from "@/lib/oauth/authorizeRequest";
import { findCoveringGrant } from "@/lib/oauth/grants";
import { issueAuthCode } from "@/lib/oauth/tokens";
import { redirectError, tokenError } from "@/lib/oauth/errors";
import { formatScope } from "@/lib/oauth/scopes";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const validated = await validateAuthorizeRequest(url.searchParams);

  if (!validated.ok) {
    const { failure } = validated;
    if (failure.kind === "fatal") return tokenError(failure.error, failure.description);
    return redirectError(failure.redirectUri, failure.error, failure.state, failure.description);
  }

  const { client, params, scopes } = validated.value;
  const session = await auth();

  if (!session?.user?.id) {
    if (params.prompt === "none") {
      return redirectError(params.redirectUri, "access_denied", params.state, "Login required");
    }
    const callback = `${url.pathname}${url.search}`;
    return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(callback)}`, url.origin));
  }

  const grant = params.prompt === "consent" ? null : await findCoveringGrant(session.user.id, client.id, scopes);

  if (!grant) {
    if (params.prompt === "none") {
      return redirectError(params.redirectUri, "access_denied", params.state, "Consent required");
    }
    return NextResponse.redirect(new URL(`/oauth/consent${url.search}`, url.origin));
  }

  const code = await issueAuthCode({
    clientId: client.id,
    userId: session.user.id,
    scopes,
    redirectUri: params.redirectUri,
    nonce: params.nonce,
    codeChallenge: params.codeChallenge,
    codeChallengeMethod: params.codeChallenge ? "S256" : null,
  });

  const target = new URL(params.redirectUri);
  target.searchParams.set("code", code);
  if (params.state) target.searchParams.set("state", params.state);
  // 同意済みの再認可でもスコープを返しておくと、クライアント側が差分を検知しやすい
  target.searchParams.set("scope", formatScope(scopes));

  return NextResponse.redirect(target.toString());
}
