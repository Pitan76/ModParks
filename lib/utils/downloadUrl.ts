/**
 * ダウンロードURLの組み立てユーティリティ。
 * コンテキストメニュー・将来的なカード上のDLボタンなど、
 * 「プロジェクトから最新版を落とす」導線すべてで共有する。
 */

/** 落とすバージョンの絞り込み条件（検索フィルタ由来） */
export type DownloadPreference = {
  loaders?:    string[];
  mcVersions?: string[];
};

/** 特定バージョンを直接ダウンロードするURL */
export const buildVersionDownloadUrl = (versionId: string): string =>
  `/api/download?versionId=${encodeURIComponent(versionId)}`;

/**
 * プロジェクトの最新バージョンをダウンロードするURL。
 * 条件に合致するものが無い場合、サーバ側は条件を無視して最新版にフォールバックする。
 */
export const buildProjectDownloadUrl = (slug: string, pref?: DownloadPreference): string => {
  const params = new URLSearchParams({ slug });
  if (pref?.loaders?.length) params.set("loaders", pref.loaders.join(","));
  if (pref?.mcVersions?.length) params.set("mcVersions", pref.mcVersions.join(","));
  return `/api/download?${params.toString()}`;
};

/** カンマ区切りクエリ値を配列へ。空なら undefined */
export const parseCsvParam = (value: string | null | undefined): string[] | undefined => {
  const items = (value ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  return items.length > 0 ? items : undefined;
};
