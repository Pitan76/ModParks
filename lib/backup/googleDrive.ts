/**
 * Google Drive へのバックアップ退避。
 *
 * Cloudflare 側の障害・アカウント停止でも失われない場所に控えを置くのが目的です。
 * R2 だけだと事業者単位のリスク（アカウント停止・請求トラブル・全体障害）に対応できません。
 *
 * cron から呼ぶため、ユーザー同意を伴う OAuth フローは使えません。
 * 代わりにサービスアカウントの秘密鍵で JWT を自己署名してアクセストークンを得ます。
 *
 * ⚠ 保存先には「共有ドライブ (Shared Drive)」のフォルダを使ってください。
 *   通常のマイドライブに置くとファイルの所有者がサービスアカウントになりますが、
 *   サービスアカウントはマイドライブの保存容量を持たないためアップロードに失敗します。
 *   共有ドライブならファイルはドライブ側の所有になり、この制限を受けません。
 */

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const UPLOAD_ENDPOINT = "https://www.googleapis.com/upload/drive/v3/files";
const FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files";
const SCOPE = "https://www.googleapis.com/auth/drive.file";

/**
 * 認証方式は 2 通りあります。
 *
 * oauth   … ユーザー本人の Drive に保存する方式。個人の Google アカウント向け。
 *            ファイルは本人の所有になるので、通常の保存容量が使えます。
 * service … サービスアカウントで保存する方式。共有ドライブが必要なため
 *            Google Workspace 前提です。個人アカウントでは
 *            "Service Accounts do not have storage quota" で失敗します。
 *
 * 両方の設定がある場合は oauth を優先します。
 */
type DriveConfig =
  | { mode: "oauth"; clientId: string; clientSecret: string; refreshToken: string; folderId: string }
  | { mode: "service"; clientEmail: string; privateKey: string; folderId: string };

/** 必要なシークレットが揃っているかを確認し、設定を返します。 */
export function getDriveConfig(): DriveConfig | null {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) return null;

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (clientId && clientSecret && refreshToken) {
    return { mode: "oauth", clientId, clientSecret, refreshToken, folderId };
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  if (clientEmail && privateKey) {
    return { mode: "service", clientEmail, privateKey, folderId };
  }

  return null;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlEncodeString(value: string): string {
  return base64UrlEncode(new TextEncoder().encode(value));
}

/**
 * サービスアカウントの PEM 秘密鍵を Web Crypto の鍵に変換します。
 * 環境変数に入れる都合で改行が "\n" のままになっている場合も受け付けます。
 */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const normalized = pem.replace(/\\n/g, "\n");
  const body = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");

  if (!body) throw new Error("GOOGLE_PRIVATE_KEY is empty or malformed");

  const binary = atob(body);
  const der = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) der[i] = binary.charCodeAt(i);

  return crypto.subtle.importKey(
    "pkcs8",
    der as BufferSource,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

/** トークンエンドポイントに問い合わせ、アクセストークンを取り出します。 */
async function requestAccessToken(body: URLSearchParams): Promise<string> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();

    // invalid_grant はリフレッシュトークンの失効。原因が分かりにくく、
    // 特に「OAuth 同意画面がテストモードのままだと 7 日で失効する」ことに
    // 気づけず自動バックアップが静かに止まるため、対処法まで含めて示す。
    if (text.includes("invalid_grant")) {
      throw new Error(
        "Google refresh token is no longer valid. This usually means the OAuth consent screen is still in " +
          "Testing mode (refresh tokens expire after 7 days) or access was revoked. " +
          "Publish the app to Production in the Google Cloud Console, then re-run scripts/google-oauth-setup.mjs " +
          `and update GOOGLE_OAUTH_REFRESH_TOKEN. Original response: ${text}`
      );
    }

    throw new Error(`Google token request failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Google token response did not contain an access token");

  return data.access_token;
}

/** 設定された方式でアクセストークンを取得します。 */
async function getAccessToken(config: DriveConfig): Promise<string> {
  if (config.mode === "oauth") {
    // リフレッシュトークンは期限が無いので、毎回これで短命のアクセストークンを得る
    return requestAccessToken(
      new URLSearchParams({
        grant_type: "refresh_token",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
      })
    );
  }

  return getServiceAccountToken(config);
}

/**
 * サービスアカウントの JWT を自己署名し、アクセストークンと交換します。
 */
async function getServiceAccountToken(
  config: Extract<DriveConfig, { mode: "service" }>
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncodeString(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64UrlEncodeString(
    JSON.stringify({
      iss: config.clientEmail,
      scope: SCOPE,
      aud: TOKEN_ENDPOINT,
      iat: now,
      // Google の上限は 1 時間。短命にしておく。
      exp: now + 3600,
    })
  );

  const signingInput = `${header}.${claims}`;
  const key = await importPrivateKey(config.privateKey);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput) as BufferSource
  );

  const jwt = `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;

  return requestAccessToken(
    new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    })
  );
}

/**
 * バックアップ本文を Drive にアップロードします。
 * メタデータと本文を 1 リクエストで送る multipart 形式を使います。
 */
export async function uploadBackupToDrive(fileName: string, content: string): Promise<string> {
  const config = getDriveConfig();
  if (!config) throw new Error("Google Drive backup is not configured");

  const token = await getAccessToken(config);

  const boundary = `boundary-${crypto.randomUUID()}`;
  const metadata = JSON.stringify({ name: fileName, parents: [config.folderId] });

  const body =
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    "Content-Type: application/json\r\n\r\n" +
    `${content}\r\n` +
    `--${boundary}--`;

  // supportsAllDrives は共有ドライブに書き込むために必須
  const res = await fetch(`${UPLOAD_ENDPOINT}?uploadType=multipart&supportsAllDrives=true`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`Google Drive upload failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error("Google Drive upload response did not contain a file id");

  return data.id;
}

interface DriveFile {
  id: string;
  name: string;
  createdTime: string;
}

/** 退避先フォルダ内のバックアップを新しい順に列挙します。 */
export async function listDriveBackups(): Promise<DriveFile[]> {
  const config = getDriveConfig();
  if (!config) throw new Error("Google Drive backup is not configured");

  const token = await getAccessToken(config);

  const params = new URLSearchParams({
    q: `'${config.folderId}' in parents and trashed = false`,
    fields: "files(id,name,createdTime)",
    orderBy: "createdTime desc",
    pageSize: "1000",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });

  const res = await fetch(`${FILES_ENDPOINT}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Google Drive list failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as { files?: DriveFile[] };
  return data.files ?? [];
}

/**
 * 世代数を保つため、Drive 上の古いバックアップを削除します。
 * 削除の失敗は退避そのものを失敗させないよう、件数だけ返して続行します。
 */
export async function pruneDriveBackups(keepCount: number): Promise<string[]> {
  const config = getDriveConfig();
  if (!config) return [];

  const token = await getAccessToken(config);
  const files = await listDriveBackups();
  const stale = files.slice(keepCount);

  const deleted: string[] = [];
  for (const file of stale) {
    const res = await fetch(`${FILES_ENDPOINT}/${file.id}?supportsAllDrives=true`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      deleted.push(file.name);
    } else {
      console.error(`[drive] Failed to delete ${file.name}: ${res.status}`);
    }
  }

  return deleted;
}
