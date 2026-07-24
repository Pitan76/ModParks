import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@/lib/services/auth";
import { getRpContext } from "@/lib/webauthn/config";
import { setChallenge } from "@/lib/webauthn/challenge";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * パスキーログイン用の認証オプションを生成する（未認証で呼ばれる）。
 *
 * discoverable credential 前提で allowCredentials は空とし、
 * どのアカウントで署名するかはブラウザ側の資格情報選択に委ねる。
 *
 * @deprecated 廃止予定。option 生成は modparks-auth サイドカー
 * （lib/services/auth.ts）へ移設済み。このルートは rate limit と challenge cookie の
 * 管理を担う互換ラッパーとして残している。
 */
export async function POST() {
  const limit = await checkRateLimit("passkey-auth-options", 30, 10 * 60 * 1000);
  if (!limit.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { rpId } = await getRpContext();

  const options = await generateAuthenticationOptions({
    rpID: rpId,
    userVerification: "preferred",
  });

  await setChallenge("auth", options.challenge);
  return NextResponse.json(options);
}
