type ProjectAuthor = {
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
} | null;

type ProjectRow<P> = {
  project: P & { tagsJson?: string | null };
  author?: ProjectAuthor;
};

/**
 * json_group_array で取得したタグ列を string[] に正規化する。
 * タグが1件もない行では [null] が返るため、その場合は空配列として扱う。
 */
const parseTagsJson = (tagsJson: string | null | undefined): string[] => {
  if (!tagsJson) return [];
  try {
    const tags = JSON.parse(tagsJson);
    if (Array.isArray(tags) && tags.length > 0 && tags[0] !== null) return tags;
  } catch {}
  return [];
};

/**
 * プロジェクト一覧クエリの行を、tagsJson を tags に展開し
 * author を authorXxx へ平坦化した表示用オブジェクトに変換する。
 */
export const mapProjectRow = <P extends object>(row: ProjectRow<P>) => {
  const { tagsJson, ...projectData } = row.project;
  return {
    ...(projectData as P),
    authorUsername: row.author?.username,
    authorDisplayName: row.author?.displayName ?? row.author?.username,
    authorAvatarUrl: row.author?.avatarUrl,
    tags: parseTagsJson(tagsJson),
  };
};
