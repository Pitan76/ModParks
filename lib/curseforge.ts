/**
 * CurseForge 連携ユーティリティ
 *
 * - 読み取り（Eternal/Console API `api.curseforge.com`）は運営が env で設定する
 *   共通の Studios コンソールキー（CURSEFORGE_FOR_STUDIOS_API_KEY）を使用する。このキーは
 *   身元と紐づかないため「誰が所有者か」の判定には使えない。
 * - 所有者（本人）判定は、各ユーザーが設定する CurseForge for Authors の
 *   アップロードAPIトークンを使って行う。トークンが対象プロジェクトの
 *   アップロードAPIにアクセスできれば、そのプロジェクトの所有者本人とみなす。
 */

const CF_API_BASE = "https://api.curseforge.com";
/** CurseForge for Authors アップロードAPI（Minecraft, gameId=432）のベースURL */
const CF_UPLOAD_BASE = "https://minecraft.curseforge.com/api";
const UA = "ModParks/1.0 (modparks.pitan76.net)";

/** 運営が設定した共通の Studios コンソールキーを取得する */
export function getConsoleApiKey(): string {
  // 運営が設定する共通の Studios コンソールキー
  const key = (process.env.CURSEFORGE_FOR_STUDIOS_API_KEY)?.trim();
  if (!key) {
    throw new Error("CurseForge のコンソールAPIキー（CURSEFORGE_FOR_STUDIOS_API_KEY）が未設定です。運営者にお問い合わせください。");
  }
  return key;
}

/** 読み取りAPI用の共通ヘッダ */
function consoleHeaders(): Record<string, string> {
  return { "x-api-key": getConsoleApiKey(), Accept: "application/json", "User-Agent": UA };
}

export interface CfProjectSummary {
  id: number;
  authors: { id: number; name: string }[];
}

/**
 * コンソールAPIでプロジェクト情報を取得する。
 * @param modId 数値のCurseForge Mod ID
 */
export async function fetchCfProject(modId: string): Promise<CfProjectSummary | null> {
  const res = await fetch(`${CF_API_BASE}/v1/mods/${modId}`, { headers: consoleHeaders() });
  if (!res.ok) return null;
  const json = (await res.json()) as any;
  return json.data ?? null;
}

/**
 * Author トークンが有効かを検証する（アップロードAPIの疎通確認）。
 * @returns 有効なら true
 */
export async function isAuthorTokenValid(authorToken: string): Promise<boolean> {
  const res = await fetch(`${CF_UPLOAD_BASE}/game/versions`, {
    headers: { "X-Api-Token": authorToken.trim(), "User-Agent": UA },
  });
  return res.ok;
}

/**
 * 指定プロジェクトの所有者本人かどうかを、Author アップロードAPIトークンで検証する。
 *
 * ぴたんの方針: コンソールAPIでプロジェクトを取得し、Author トークンで
 * そのプロジェクトのアップロードAPI（所有者のみアクセス可能なエンドポイント）に
 * アクセスできれば本人所有と判定する。
 *
 * @param modId 数値のCurseForge Mod ID
 * @param authorToken CurseForge for Authors のアップロードAPIトークン
 * @returns 所有者本人なら true
 */
export async function verifyCfProjectOwnership(modId: string, authorToken: string): Promise<boolean> {
  const token = authorToken.trim();
  if (!token) return false;

  // プロジェクトのアップロードファイル一覧は所有者のみ取得できる。
  // 200 → 所有者、401/403 → 非所有者/無効トークン。
  const res = await fetch(`${CF_UPLOAD_BASE}/projects/${modId}/files`, {
    headers: { "X-Api-Token": token, "User-Agent": UA },
  });
  return res.ok;
}
