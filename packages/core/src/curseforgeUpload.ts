/**
 * CurseForge Upload API（書き込み系）のユーティリティ。
 *
 * 読み取り専用の運営共通キー（{@link ../curseforge}）とは別に、各ユーザーが
 * 自分の CurseForge アカウントで発行する個人トークン（authors-old.curseforge.com/account/api-tokens）
 * を使う。このトークンは本人が権限を持つプロジェクトにのみ書き込める。
 *
 * 参考: https://support.curseforge.com/en/support/solutions/articles/9000197321-curseforge-upload-api
 */

const CF_UPLOAD_API_BASE = "https://minecraft.curseforge.com";

/** `GET /api/game/versions` が返す1エントリ（MCバージョン・モッドローダー共通） */
interface CfGameVersionEntry {
  id: number;
  name: string;
}

function uploadHeaders(apiToken: string): Record<string, string> {
  return { "X-Api-Token": apiToken };
}

/**
 * CurseForge が管理する「ゲームバージョン／モッドローダー」の名前→ID対応表を取得する。
 * `gameVersions` フィールドは数値IDの配列でしか指定できないため、事前にこれで解決する。
 */
export async function fetchCfGameVersionMap(apiToken: string): Promise<Map<string, number>> {
  const res = await fetch(`${CF_UPLOAD_API_BASE}/api/game/versions`, { headers: uploadHeaders(apiToken) });
  if (!res.ok) {
    throw new Error(`Failed to fetch CurseForge game versions. Status: ${res.status}`);
  }
  const entries = (await res.json()) as CfGameVersionEntry[];
  return new Map(entries.map((e) => [e.name.toLowerCase(), e.id]));
}

/**
 * 名前の配列（MCバージョン・ローダー名）をCurseForgeの数値IDに解決する。
 * @returns 解決できたID配列と、対応が見つからなかった名前の配列
 */
export function resolveCfGameVersionIds(
  names: string[],
  versionMap: Map<string, number>,
): { ids: number[]; unresolved: string[] } {
  const ids: number[] = [];
  const unresolved: string[] = [];
  for (const name of names) {
    const id = versionMap.get(name.toLowerCase());
    if (id === undefined) unresolved.push(name);
    else ids.push(id);
  }
  return { ids, unresolved };
}

/**
 * 既存ファイルの対応バージョン（gameVersions）等を更新する。
 * gameVersions は差分ではなく置き換えのため、呼び出し側で既存分とマージした完全な配列を渡すこと。
 */
export async function updateCfFileGameVersions(
  projectId: string,
  fileId: number,
  gameVersionIds: number[],
  apiToken: string,
): Promise<void> {
  const form = new FormData();
  form.append("metadata", JSON.stringify({ fileID: fileId, gameVersions: gameVersionIds }));

  const res = await fetch(`${CF_UPLOAD_API_BASE}/api/projects/${projectId}/update-file`, {
    method: "POST",
    headers: uploadHeaders(apiToken),
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`CurseForge update-file failed. Status: ${res.status} ${detail}`);
  }
}

export type CfUploadMetadata = {
  changelog: string;
  changelogType?: "text" | "html" | "markdown";
  displayName?: string;
  gameVersions: number[];
  releaseType: "alpha" | "beta" | "release";
};

/** 新しいファイルを CurseForge プロジェクトへアップロードし、発行されたファイルIDを返す */
export async function uploadCfFile(
  projectId: string,
  apiToken: string,
  metadata: CfUploadMetadata,
  file: Blob,
  fileName: string,
): Promise<number> {
  const form = new FormData();
  form.append("metadata", JSON.stringify(metadata));
  form.append("file", file, fileName);

  const res = await fetch(`${CF_UPLOAD_API_BASE}/api/projects/${projectId}/upload-file`, {
    method: "POST",
    headers: uploadHeaders(apiToken),
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`CurseForge upload-file failed. Status: ${res.status} ${detail}`);
  }
  const json = (await res.json()) as { id: number };
  return json.id;
}
