import { useMemo, useState } from "react";

export type SortOrder = "asc" | "desc";

export type SortValue = string | number | Date | null | undefined;

export type SortGetters<T, K extends string> = Record<K, (row: T) => SortValue>;

const compare = (a: SortValue, b: SortValue): number => {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
};

/**
 * テーブルのヘッダクリックによるクライアント側の並び替えを提供する共通フック。
 * 同じ列を再度押すと昇順/降順が切り替わる。
 *
 * @param rows 元データ
 * @param getters 列キーごとの、比較に使う値を取り出す関数
 * @param initial 初期のソート列と向き(任意)
 */
export function useTableSort<T, K extends string>(
  rows: T[],
  getters: SortGetters<T, K>,
  initial?: { orderBy: K; order?: SortOrder },
) {
  const [orderBy, setOrderBy] = useState<K | null>(initial?.orderBy ?? null);
  const [order, setOrder] = useState<SortOrder>(initial?.order ?? "asc");

  const handleSort = (key: K) => {
    if (orderBy === key) {
      setOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setOrderBy(key);
    setOrder("asc");
  };

  const sorted = useMemo(() => {
    if (!orderBy) return rows;
    const getter = getters[orderBy];
    const dir = order === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => compare(getter(a), getter(b)) * dir);
    // gettersは各レンダーで再生成されるが、ソート結果はorderBy/orderに依存するため除外する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, orderBy, order]);

  return { sorted, order, orderBy, handleSort };
}
