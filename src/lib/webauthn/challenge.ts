import { cookies } from "next/headers";

/**
 * WebAuthn のチャレンジ文字列を短命な httpOnly cookie に保持する。
 *
 * jwt セッション戦略のため DB セッションに載せられない。options 発行と
 * verify の 2 リクエスト間だけ有効な一時値として cookie を用いる。
 */
const MAX_AGE_SEC = 300;

const cookieName = (kind: "reg" | "auth") => `webauthn_challenge_${kind}`;

export const setChallenge = async (kind: "reg" | "auth", challenge: string): Promise<void> => {
  const store = await cookies();
  store.set(cookieName(kind), challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
};

export const getChallenge = async (kind: "reg" | "auth"): Promise<string | undefined> => {
  const store = await cookies();
  return store.get(cookieName(kind))?.value;
};

export const clearChallenge = async (kind: "reg" | "auth"): Promise<void> => {
  const store = await cookies();
  store.delete(cookieName(kind));
};
