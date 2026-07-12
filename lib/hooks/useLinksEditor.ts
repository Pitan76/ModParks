import { useState } from "react";

export interface LinkItem {
  title: string;
  url: string;
}

/** JSON 文字列（`[{title,url}]`）を安全に LinkItem[] へパースする */
export function parseLinks(raw?: string | null): LinkItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * プロフィール / プロジェクトのカスタムリンク編集を扱う共通フック。
 * 追加・削除・変更のロジックが複数フォームで重複していたのを集約する。
 */
export function useLinksEditor(rawInitial?: string | null) {
  const [links, setLinks] = useState<LinkItem[]>(() => parseLinks(rawInitial));

  const addLink = () => setLinks((prev) => [...prev, { title: "", url: "" }]);
  const removeLink = (idx: number) => setLinks((prev) => prev.filter((_, i) => i !== idx));
  const changeLink = (idx: number, field: keyof LinkItem, val: string) =>
    setLinks((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item)));

  return { links, setLinks, addLink, removeLink, changeLink };
}
