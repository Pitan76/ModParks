/**
 * Modrinth Upload API（書き込み系）のユーティリティ。
 * 公式ドキュメント: https://docs.modrinth.com/api/operations/createversion/
 */

const MODRINTH_API_BASE = "https://api.modrinth.com/v2";
const UA = "ModParks/1.0 (modparks.pitan76.net)";

export type ModrinthCreateVersionInput = {
  modrinthProjectId: string;
  versionNumber: string;
  changelog: string;
  gameVersions: string[];
  loaders: string[];
  /** release | beta | alpha */
  releaseChannel: string;
  file: Blob;
  fileName: string;
};

/** 新しいバージョン（ファイル）を Modrinth プロジェクトへ作成し、発行されたバージョンIDを返す */
export async function createModrinthVersion(apiKey: string, input: ModrinthCreateVersionInput): Promise<string> {
  const form = new FormData();
  form.append(
    "data",
    JSON.stringify({
      name: input.versionNumber,
      version_number: input.versionNumber,
      changelog: input.changelog,
      dependencies: [],
      game_versions: input.gameVersions,
      version_type: input.releaseChannel,
      loaders: input.loaders,
      featured: false,
      project_id: input.modrinthProjectId,
      file_parts: [input.fileName],
    }),
  );
  form.append(input.fileName, input.file, input.fileName);

  const res = await fetch(`${MODRINTH_API_BASE}/version`, {
    method: "POST",
    headers: { Authorization: apiKey, "User-Agent": UA },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Modrinth version creation failed. Status: ${res.status} ${detail}`);
  }
  const json = (await res.json()) as { id: string };
  return json.id;
}
