/**
 * Google Drive バックアップ用のリフレッシュトークンを取得するセットアップスクリプト。
 *
 * 個人の Google アカウントではサービスアカウントが使えない
 * （共有ドライブが必要で、それは Google Workspace の機能）ため、
 * 本人の Drive に保存する OAuth 方式のトークンをここで用意します。
 *
 * 事前準備:
 *   1. Google Cloud Console で Drive API を有効化
 *   2. OAuth 同意画面を「外部」で作成（「内部」は Google Workspace 専用）
 *   3. 同意画面の公開ステータスを「本番環境」にする
 *      ※ テストモードのままだとリフレッシュトークンが 7 日で失効し、
 *        自動バックアップが静かに止まります。drive.file は非機密スコープなので
 *        本番公開に Google の審査は不要です。
 *   4. 「OAuth 2.0 クライアント ID」を "デスクトップアプリ" として作成
 *   5. その client ID / client secret を控える
 *
 * 使い方:
 *   node scripts/google-oauth-setup.mjs <client_id> <client_secret>
 *
 * 最後に表示される 3 つの値を Worker のシークレットに登録してください。
 */
import http from "node:http";
import { randomBytes } from "node:crypto";

const PORT = 5555;
const REDIRECT_URI = `http://localhost:${PORT}`;
// drive.file はこのアプリが作成したファイルにだけ触れる最小権限。
// バックアップ用フォルダもこのスクリプトで作るので、これで足ります。
const SCOPE = "https://www.googleapis.com/auth/drive.file";

const [clientId, clientSecret] = process.argv.slice(2);

if (!clientId || !clientSecret) {
  console.error("Usage: node scripts/google-oauth-setup.mjs <client_id> <client_secret>");
  console.error("\nGoogle Cloud Console で「デスクトップアプリ」型の OAuth クライアントを作成し、");
  console.error(`リダイレクト URI に ${REDIRECT_URI} を登録してから実行してください。`);
  process.exit(1);
}

const state = randomBytes(16).toString("hex");

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    // offline + consent でリフレッシュトークンを確実に受け取る
    access_type: "offline",
    prompt: "consent",
    state,
  });

console.log("\n次の URL をブラウザで開いて許可してください:\n");
console.log(authUrl);
console.log("\n許可を待っています...\n");

/** 認可コードを受け取るための一時サーバー */
const code = await new Promise((resolve, reject) => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, REDIRECT_URI);
    const received = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });

    if (url.searchParams.get("state") !== state) {
      res.end("<h1>state が一致しません。もう一度実行してください。</h1>");
      server.close();
      reject(new Error("state mismatch"));
      return;
    }
    if (error || !received) {
      res.end(`<h1>認可に失敗しました: ${error ?? "code がありません"}</h1>`);
      server.close();
      reject(new Error(error ?? "no code"));
      return;
    }

    res.end("<h1>完了しました。ターミナルに戻ってください。</h1>");
    server.close();
    resolve(received);
  });

  server.listen(PORT);
  server.on("error", reject);
});

// 認可コードをリフレッシュトークンに交換する
const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
  }),
});

if (!tokenRes.ok) {
  console.error("トークン交換に失敗しました:", await tokenRes.text());
  process.exit(1);
}

const { refresh_token: refreshToken, access_token: accessToken } = await tokenRes.json();

if (!refreshToken) {
  console.error("リフレッシュトークンが返りませんでした。");
  console.error("Google アカウントのアプリ連携設定からこのアプリのアクセスを解除して、再実行してください。");
  process.exit(1);
}

// バックアップ用フォルダを作る。
// このスクリプトが作ったフォルダなので drive.file の権限だけで読み書きできます。
const folderRes = await fetch("https://www.googleapis.com/drive/v3/files", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: "ModParks Backups",
    mimeType: "application/vnd.google-apps.folder",
  }),
});

if (!folderRes.ok) {
  console.error("フォルダ作成に失敗しました:", await folderRes.text());
  process.exit(1);
}

const folder = await folderRes.json();

console.log("成功しました。以下の 4 つを Worker のシークレットに登録してください:\n");
console.log(`GOOGLE_OAUTH_CLIENT_ID     = ${clientId}`);
console.log(`GOOGLE_OAUTH_CLIENT_SECRET = ${clientSecret}`);
console.log(`GOOGLE_OAUTH_REFRESH_TOKEN = ${refreshToken}`);
console.log(`GOOGLE_DRIVE_FOLDER_ID     = ${folder.id}`);
console.log(`\nDrive に「${folder.name}」フォルダを作成しました。ここにバックアップが保存されます。`);
console.log("※ リフレッシュトークンは Drive への書き込み権限そのものです。取り扱いに注意してください。");
