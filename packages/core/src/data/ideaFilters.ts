/**
 * アイデア一覧の絞り込み・並び替えで使う値。
 * URL のクエリと DB の値の対応をここ1箇所に置く。
 */

/** ideas.status と同じ並び。フィルタの選択肢の順序も兼ねる */
export const IDEA_STATUSES = ["open", "in_progress", "fulfilled"] as const;

export type IdeaStatusValue = (typeof IDEA_STATUSES)[number];

export const IDEA_SORTS = ["newest", "oldest", "popular", "comments"] as const;

export type IdeaSortValue = (typeof IDEA_SORTS)[number];

/**
 * 状態の表示に使う翻訳キー。
 * DB は fulfilled だが表示は「解決済み」なので、キー名だけずれている。
 */
export function ideaStatusLabelKey(status: string): string {
  return status === "fulfilled" ? "status.resolved" : `status.${status}`;
}

/** クエリ文字列を状態の配列に開く。未知の値は捨てる */
export function parseIdeaStatuses(raw: string | undefined): IdeaStatusValue[] {
  if (!raw) return [];
  const values = raw.split(",");
  return IDEA_STATUSES.filter((status) => values.includes(status));
}

/** クエリ文字列を並び順に変換する。未知の値は既定に倒す */
export function parseIdeaSort(raw: string | undefined): IdeaSortValue {
  return IDEA_SORTS.find((sort) => sort === raw) ?? "newest";
}
