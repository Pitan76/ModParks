"use server";

import { auth } from "@/lib/auth";
import { validateAuthorizeRequest } from "@/lib/oauth/authorizeRequest";
import { saveGrant } from "@/lib/oauth/grants";
import { issueAuthCode } from "@/lib/oauth/tokens";

type ConsentResult = { success: true; redirectTo: string } | { success: false; error: string };

/**
 * 同意画面の「許可する」。認可コードを発行し、戻り先 URL を返す。
 * リダイレクトはクライアント側で行うため、ここでは URL を返すだけにする。
 */
export async function approveAuthorization(rawQuery: string): Promise<ConsentResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "unauthenticated" };

  const validated = await validateAuthorizeRequest(new URLSearchParams(rawQuery));
  if (!validated.ok) return { success: false, error: validated.failure.error };

  const { client, params, scopes } = validated.value;
  await saveGrant(session.user.id, client.id, scopes);

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
  target.searchParams.set("scope", scopes.join(" "));

  return { success: true, redirectTo: target.toString() };
}

/**
 * 同意画面の「拒否する」。access_denied を付けてクライアントへ戻す。
 */
export async function denyAuthorization(rawQuery: string): Promise<ConsentResult> {
  const validated = await validateAuthorizeRequest(new URLSearchParams(rawQuery));
  if (!validated.ok) return { success: false, error: validated.failure.error };

  const { params } = validated.value;
  const target = new URL(params.redirectUri);
  target.searchParams.set("error", "access_denied");
  if (params.state) target.searchParams.set("state", params.state);

  return { success: true, redirectTo: target.toString() };
}
