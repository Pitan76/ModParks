/**
 * CurseForge 連携ユーティリティ
 *
 * - 読み取り（Eternal/Console API `api.curseforge.com`）は運営が env で設定する
 *   共通の Studios コンソールキー（CURSEFORGE_FOR_STUDIOS_API_KEY）を使用する。このキーは
 *   身元と紐づかないため「誰が所有者か」の判定には使えない。
 * - 所有者（本人）判定は、発行した確認コードを対象プロジェクトの公開フィールド
 *   （説明文・Source/Issues/Wiki リンク）に記載してもらい、コンソールAPIで読み取って
 *   照合するチャレンジコード方式で行う。プロジェクト編集は所有者しかできないため。
 *   （アップロードAPIは所有確認に使える安全なエンドポイントを持たない）
 */

const CF_API_BASE = "https://api.curseforge.com";
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
  summary?: string;
  /** websiteUrl は常にCFプロジェクトページに固定されユーザー値を反映しないため所有確認には使わない */
  links?: { wikiUrl?: string; issuesUrl?: string; sourceUrl?: string };
}

/** gameId=432 は Minecraft */
const MINECRAFT_GAME_ID = 432;

/**
 * コンソールAPIでプロジェクト情報を取得する。
 * 数値 Mod ID・スラッグのどちらでも解決する（スラッグは検索APIで数値IDに変換）。
 * @param projectRef 数値のCurseForge Mod ID もしくはスラッグ
 */
export async function fetchCfProject(projectRef: string): Promise<CfProjectSummary | null> {
  const ref = projectRef.trim();
  if (/^\d+$/.test(ref)) return fetchCfProjectByModId(ref);
  return fetchCfProjectBySlug(ref);
}

/** 数値 Mod ID で直接取得する */
async function fetchCfProjectByModId(modId: string): Promise<CfProjectSummary | null> {
  const res = await fetch(`${CF_API_BASE}/v1/mods/${modId}`, { headers: consoleHeaders() });
  if (!res.ok) {
    console.warn(`[curseforge] fetch by modId failed: modId=${modId} status=${res.status}`);
    return null;
  }
  const json = (await res.json()) as any;
  return json.data ?? null;
}

/**
 * 指定作者のMinecraftプロジェクト一覧をコンソールAPIで取得する。
 * @param authorId 数値のCurseForge作者ID
 * @returns 検索APIの生プロジェクト配列
 */
export async function fetchCfAuthorProjects(authorId: string): Promise<any[]> {
  const url = `${CF_API_BASE}/v1/mods/search?gameId=${MINECRAFT_GAME_ID}&authorId=${encodeURIComponent(authorId)}`;
  const res = await fetch(url, { headers: consoleHeaders() });
  if (!res.ok) {
    console.warn(`[curseforge] search by authorId failed: authorId=${authorId} status=${res.status}`);
    throw new Error(`Failed to fetch CurseForge projects. Status: ${res.status}`);
  }
  const json = (await res.json()) as { data?: any[] };
  return json.data ?? [];
}

/** スラッグを検索APIで数値IDに解決して取得する */
async function fetchCfProjectBySlug(slug: string): Promise<CfProjectSummary | null> {
  const url = `${CF_API_BASE}/v1/mods/search?gameId=${MINECRAFT_GAME_ID}&slug=${encodeURIComponent(slug)}`;
  const res = await fetch(url, { headers: consoleHeaders() });
  if (!res.ok) {
    console.warn(`[curseforge] search by slug failed: slug=${slug} status=${res.status}`);
    return null;
  }
  const json = (await res.json()) as { data?: CfProjectSummary[] };
  return json.data?.[0] ?? null;
}

/**
 * プロジェクトの公開フィールド（説明文・Source/Issues/Wiki リンク）に
 * 所有確認コードが記載されているかを照合する。プロジェクトの編集は所有者しか
 * できないため、コードの存在をもって本人所有と判定する。
 *
 * @param project コンソールAPIで取得したプロジェクト情報
 * @param code 発行済みの所有確認コード
 */
export function projectContainsCode(project: CfProjectSummary, code: string): boolean {
  const needle = code.trim();
  if (!needle) return false;
  const haystack = [
    project.summary ?? "",
    project.links?.wikiUrl ?? "",
    project.links?.issuesUrl ?? "",
    project.links?.sourceUrl ?? "",
  ].join("\n");
  return haystack.includes(needle);
}
