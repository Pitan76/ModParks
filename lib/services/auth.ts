import type {
  RegistrationOptionsRequest,
  RegistrationOptionsResult,
  AuthenticationOptionsRequest,
  AuthenticationOptionsResult,
  VerifyRegistrationRequest,
  VerifyRegistrationResult,
  VerifyAuthenticationRequest,
  VerifyAuthenticationResult,
  BcryptHashResult,
  BcryptCompareResult,
} from "@/workers/auth/src/types";

export type {
  RegistrationOptionsResult,
  AuthenticationOptionsResult,
  VerifyRegistrationResult,
  VerifyAuthenticationResult,
};

/**
 * modparks-auth Worker のクライアント。
 *
 * WebAuthn の option 生成・検証には @simplewebauthn/server（gzip ~125 KiB）が
 * 必要だが、これをメインアプリに載せると Worker の 3 MiB 制限を超えるため、
 * 暗号処理はサイドカー Worker に隔離している。ここは Service Binding 越しの
 * 呼び出しだけを担い、@simplewebauthn/server を一切参照しない。
 */
async function getAuthWorker(): Promise<Fetcher> {
  const env = await getWorkerEnv();
  const auth = (env as unknown as { AUTH?: Fetcher }).AUTH;
  if (!auth) throw new Error("AUTH service binding not found (deploy modparks-auth first)");
  return auth;
}

async function getWorkerEnv(): Promise<unknown> {
  if (process.env.NODE_ENV === "development" && process.release?.name === "node") {
    const { getCachedPlatformProxy } = await import("@/lib/proxy");
    return (await getCachedPlatformProxy()).env;
  }
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  return (await getCloudflareContext({ async: true })).env;
}

/** Service Binding に POST し、JSON を返す。Worker 側のエラーは例外として伝播させる。 */
async function callAuthWorker<T>(path: string, body: unknown): Promise<T> {
  const auth = await getAuthWorker();
  const res = await auth.fetch(`https://modparks-auth${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(payload.error || `auth worker returned ${res.status}`);
  return payload;
}

/** パスキー登録用の PublicKeyCredentialCreationOptions を生成する */
export function generateRegistrationOptions(
  req: RegistrationOptionsRequest
): Promise<RegistrationOptionsResult> {
  return callAuthWorker<RegistrationOptionsResult>("/registration-options", req);
}

/** パスキーログイン用の PublicKeyCredentialRequestOptions を生成する */
export function generateAuthenticationOptions(
  req: AuthenticationOptionsRequest
): Promise<AuthenticationOptionsResult> {
  return callAuthWorker<AuthenticationOptionsResult>("/authentication-options", req);
}

/** パスキー登録レスポンスを検証する（credentialID/publicKey は base64url で返る） */
export function verifyRegistration(
  req: VerifyRegistrationRequest
): Promise<VerifyRegistrationResult> {
  return callAuthWorker<VerifyRegistrationResult>("/verify-registration", req);
}

/** パスキー認証（ログイン）レスポンスを検証する */
export function verifyAuthentication(
  req: VerifyAuthenticationRequest
): Promise<VerifyAuthenticationResult> {
  return callAuthWorker<VerifyAuthenticationResult>("/verify-authentication", req);
}

/**
 * パスワードを bcrypt でハッシュ化する。
 * bcrypt(gzip ~9 KiB)を本体バンドルから外すためサイドカーで実行する。
 * rounds は Cloudflare Workers の CPU 制限を踏まえ呼び出し側で指定（既定 8）。
 */
export async function hashPassword(password: string, rounds = 8): Promise<string> {
  const { hash } = await callAuthWorker<BcryptHashResult>("/bcrypt-hash", { password, rounds });
  return hash;
}

/** 平文パスワードと bcrypt ハッシュを比較する */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  const { match } = await callAuthWorker<BcryptCompareResult>("/bcrypt-compare", { password, hash });
  return match;
}
