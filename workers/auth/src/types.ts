import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/types";

// このファイルは型のみ（実行時 import 禁止）。メインアプリと sidecar の両方から
// 読み込まれるため、値を import すると @simplewebauthn/server がメイン Worker の
// バンドルに混入して 3 MiB 制限対策の意味がなくなる。

/** 認証情報を DB 都合の base64url 文字列でやり取りするための表現 */
export interface AuthenticatorRecord {
  /** base64url エンコードされた credentialID */
  credentialID: string;
  /** base64url エンコードされた公開鍵 */
  credentialPublicKey: string;
  counter: number;
  transports?: AuthenticatorTransportFuture[];
}

// ── /registration-options ──────────────────────────────────────────────
export interface RegistrationOptionsRequest {
  rpName: string;
  rpID: string;
  userID: string;
  userName: string;
  userDisplayName: string;
  /** 既存パスキー（base64url の credentialID）— excludeCredentials に使う */
  excludeCredentials: { id: string; transports?: AuthenticatorTransportFuture[] }[];
}
export type RegistrationOptionsResult = PublicKeyCredentialCreationOptionsJSON;

// ── /authentication-options ────────────────────────────────────────────
export interface AuthenticationOptionsRequest {
  rpID: string;
  userVerification: "required" | "preferred" | "discouraged";
}
export type AuthenticationOptionsResult = PublicKeyCredentialRequestOptionsJSON;

// ── /verify-registration ───────────────────────────────────────────────
export interface VerifyRegistrationRequest {
  response: RegistrationResponseJSON;
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRPID: string;
}
export interface VerifyRegistrationResult {
  verified: boolean;
  /** verified が true のときのみ存在。credentialID/publicKey は base64url */
  registrationInfo?: {
    credentialID: string;
    credentialPublicKey: string;
    counter: number;
    credentialDeviceType: string;
    credentialBackedUp: boolean;
  };
}

// ── /verify-authentication ─────────────────────────────────────────────
export interface VerifyAuthenticationRequest {
  response: AuthenticationResponseJSON;
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRPID: string;
  authenticator: AuthenticatorRecord;
}
export interface VerifyAuthenticationResult {
  verified: boolean;
  /** verified が true のときのみ意味を持つ更新後カウンタ */
  newCounter: number;
}

// ── /bcrypt-hash ───────────────────────────────────────────────────────
export interface BcryptHashRequest {
  password: string;
  /** salt rounds（Cloudflare Workers の CPU 制限を考慮し呼び出し側で指定） */
  rounds: number;
}
export interface BcryptHashResult {
  hash: string;
}

// ── /bcrypt-compare ────────────────────────────────────────────────────
export interface BcryptCompareRequest {
  password: string;
  hash: string;
}
export interface BcryptCompareResult {
  match: boolean;
}

// ── /totp-validate ─────────────────────────────────────────────────────
export interface TotpValidateRequest {
  /** base32 シークレット（DB の twoFactorSecret） */
  secret: string;
  token: string;
  /** 許容する時間窓（前後ステップ数）。既定 1 */
  window?: number;
}
export interface TotpValidateResult {
  /** validate が delta を返した（= トークンが有効）か */
  valid: boolean;
}

// ── /totp-provision ────────────────────────────────────────────────────
export interface TotpProvisionRequest {
  /** otpauth URI に載せる label（メール/ユーザー名など） */
  label: string;
}
export interface TotpProvisionResult {
  /** DB に保存する base32 シークレット */
  base32: string;
  /** 認証アプリ登録用の otpauth:// URI */
  uri: string;
}
