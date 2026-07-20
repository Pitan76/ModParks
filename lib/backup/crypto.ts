/**
 * バックアップ内の機密テーブルの暗号化。
 *
 * バックアップにはパスワードハッシュ・API キー・2FA 秘密鍵が含まれます。
 * R2 やダウンロードした JSON、さらに Cloudflare 外の退避先にまで
 * これらが平文で置かれるのを避けるため、機密テーブルだけを AES-GCM で包みます。
 *
 * 機密でないテーブルは平文のまま残すので、バックアップの中身を人が確認できます。
 */

/**
 * 暗号化して保存するテーブル。
 * mergePolicy で "manual" / "skip" に分類した、認証・資格情報まわりが対象です。
 */
export const SENSITIVE_TABLES = new Set([
  "users",
  "account",
  "api_keys",
  "authenticator",
  "session",
  "password_reset_tokens",
  "verificationToken",
  // 外部サービスの API キーや所有確認トークンを持つ
  "user_settings",
]);

/** 暗号化されたテーブルデータの入れ物。平文の配列と形で区別できます。 */
export interface EncryptedEnvelope {
  __encrypted: true;
  alg: "AES-GCM";
  /** base64 の初期化ベクトル (12 バイト) */
  iv: string;
  /** base64 の暗号文 */
  data: string;
}

/** 値が暗号化済みの入れ物かどうかを判定します。 */
export function isEncryptedEnvelope(value: unknown): value is EncryptedEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as EncryptedEnvelope).__encrypted === true &&
    typeof (value as EncryptedEnvelope).data === "string"
  );
}

const KEY_ENV_NAME = "BACKUP_ENCRYPTION_KEY";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * 暗号鍵を取得します。
 *
 * 鍵が未設定なら例外にします。黙って平文で保存すると、
 * 「暗号化されているつもり」の状態で認証情報が外部に出てしまうためです。
 */
async function getKey(): Promise<CryptoKey> {
  const raw = process.env[KEY_ENV_NAME];
  if (!raw) {
    throw new Error(
      `${KEY_ENV_NAME} is not configured. Generate one with: openssl rand -base64 32`
    );
  }

  const keyBytes = fromBase64(raw);
  if (keyBytes.length !== 32) {
    throw new Error(`${KEY_ENV_NAME} must be 32 bytes (base64-encoded). Got ${keyBytes.length}.`);
  }

  return crypto.subtle.importKey("raw", keyBytes as BufferSource, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

/** 鍵が設定されているかどうか（UI での事前チェック用）。 */
export function isEncryptionConfigured(): boolean {
  return Boolean(process.env[KEY_ENV_NAME]);
}

/** 任意の JSON 値を暗号化して入れ物に包みます。 */
export async function encryptJson(value: unknown): Promise<EncryptedEnvelope> {
  const key = await getKey();
  // GCM の IV は 12 バイト。鍵を替えずに使い回すと破綻するため毎回生成する。
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    plaintext as BufferSource
  );

  return {
    __encrypted: true,
    alg: "AES-GCM",
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(ciphertext)),
  };
}

/** 入れ物を復号して元の JSON 値に戻します。 */
export async function decryptJson(envelope: EncryptedEnvelope): Promise<unknown> {
  const key = await getKey();

  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(envelope.iv) as BufferSource },
      key,
      fromBase64(envelope.data) as BufferSource
    );
  } catch {
    // AES-GCM は改ざんや鍵違いを認証タグで検出する。区別できないので同じ文言にする。
    throw new Error(
      `Failed to decrypt backup. The backup may have been created with a different ${KEY_ENV_NAME}, or the file is corrupted.`
    );
  }

  return JSON.parse(new TextDecoder().decode(plaintext));
}
