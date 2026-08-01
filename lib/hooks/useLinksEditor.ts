import { useState, type Dispatch, type SetStateAction } from "react";
import { parseLinks, type LinkItem } from "@/lib/utils/links";

export { parseLinks, type LinkItem };

/**
 * プロフィール / プロジェクトのカスタムリンク編集を扱う共通フック。
 * 追加・削除・変更のロジックが複数フォームで重複していたのを集約する。
 *
 * external を渡すと状態を外部（useDirtyForm など）に委ねる。
 * 未保存判定にリンクの編集を含めたいフォームで使う。
 */
export function useLinksEditor(
  rawInitial?: string | null,
  external?: { links: LinkItem[]; setLinks: Dispatch<SetStateAction<LinkItem[]>> }
) {
  const [internalLinks, setInternalLinks] = useState<LinkItem[]>(() => parseLinks(rawInitial));
  const links = external ? external.links : internalLinks;
  const setLinks = external ? external.setLinks : setInternalLinks;

  const addLink = () => setLinks((prev) => [...prev, { title: "", url: "" }]);
  const removeLink = (idx: number) => setLinks((prev) => prev.filter((_, i) => i !== idx));
  const changeLink = (idx: number, field: keyof LinkItem, val: string) =>
    setLinks((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item)));

  /** リンクを1つ上/下へ入れ替えて並び替える。範囲外の移動は無視する。 */
  const moveLink = (idx: number, dir: -1 | 1) =>
    setLinks((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });

  return { links, setLinks, addLink, removeLink, changeLink, moveLink };
}
