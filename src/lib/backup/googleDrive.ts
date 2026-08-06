const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const UPLOAD_ENDPOINT = "https://www.googleapis.com/upload/drive/v3/files";
const FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files";
const SCOPE = "https://www.googleapis.com/auth/drive.file";

type DriveConfig =
  | { mode: "oauth"; clientId: string; clientSecret: string; refreshToken: string; folderId: string }
  | { mode: "service"; clientEmail: string; privateKey: string; folderId: string };

/**
 * 必要な環境変数が揃っているか確認し、Google Drive 連携の設定オブジェクトを返します。
 */
export const getDriveConfig = (): DriveConfig | null => {
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
};

const base64UrlEncode = (bytes: Uint8Array): string => {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const base64UrlEncodeString = (value: string): string => base64UrlEncode(new TextEncoder().encode(value));

const importPrivateKey = async (pem: string): Promise<CryptoKey> => {
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
};

const requestAccessToken = async (body: URLSearchParams): Promise<string> => {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
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
};

const getServiceAccountToken = async (config: Extract<DriveConfig, { mode: "service" }>): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncodeString(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64UrlEncodeString(
    JSON.stringify({
      iss: config.clientEmail,
      scope: SCOPE,
      aud: TOKEN_ENDPOINT,
      iat: now,
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
};

const getAccessToken = async (config: DriveConfig): Promise<string> => {
  if (config.mode === "oauth") {
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
};

export type DriveUploadResult = {
  id: string;
  webViewLink?: string;
  parents?: string[];
};

/**
 * データベースバックアップのJSONデータを Google Drive にアップロードします。
 */
export const uploadBackupToDrive = async (fileName: string, content: string): Promise<DriveUploadResult> => {
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

  const uploadParams = new URLSearchParams({
    uploadType: "multipart",
    supportsAllDrives: "true",
    fields: "id,name,parents,webViewLink",
  });

  const res = await fetch(`${UPLOAD_ENDPOINT}?${uploadParams}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) throw new Error(`Google Drive upload failed (${res.status}): ${await res.text()}`);

  const data = (await res.json()) as DriveUploadResult & { id?: string };
  if (!data.id) throw new Error("Google Drive upload response did not contain a file id");

  if (data.parents && !data.parents.includes(config.folderId)) {
    console.warn(`[drive] Uploaded file landed in ${JSON.stringify(data.parents)} but folder ID is ${config.folderId}`);
  }

  return { id: data.id, webViewLink: data.webViewLink, parents: data.parents };
};

type DriveFile = {
  id: string;
  name: string;
  createdTime: string;
};

/**
 * 指定された退避先フォルダ内のバックアップファイル一覧を新しい順に列挙します。
 */
export const listDriveBackups = async (): Promise<DriveFile[]> => {
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

  if (!res.ok) throw new Error(`Google Drive list failed (${res.status}): ${await res.text()}`);

  const data = (await res.json()) as { files?: DriveFile[] };
  return data.files ?? [];
};

/**
 * 世代数制限を維持するため、Google Drive 上の古いバックアップを削除します。
 */
export const pruneDriveBackups = async (keepCount: number): Promise<string[]> => {
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
};
