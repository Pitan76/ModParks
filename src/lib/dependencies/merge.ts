/**
 * 表示用に依存関係をまとめる。
 *
 * DB上は「プラットフォームごと」「バージョンごと」に別の行として持つため、
 * 同じ前提MODが一覧に何度も並んでしまう。読む側が知りたいのは
 * 「何が要るか」であって行数ではないので、対象と種別が同じものは1件に畳む。
 *
 * 編集UIは行単位の削除が要るため、こちらは通さないこと。
 */
import type { DependencyEntry, DependencyProjectSummary } from "@modparks/core/dependencies/entryTypes";
import type { DependencyType } from "@modparks/core/dependencies/types";

type DependentEntry = {
  id: string;
  dependencyType: DependencyType;
  project: DependencyProjectSummary;
};

/** 同一の依存とみなす条件。ModParks内は対象プロジェクト、外部はURLで見る */
const mergeKey = (entry: { dependencyType: DependencyType; project: { id: string }; externalUrl?: string | null }) => {
  const target = entry.externalUrl ? `ext:${entry.externalUrl.toLowerCase()}` : `prj:${entry.project.id}`;
  return `${entry.dependencyType}|${target}`;
};

/**
 * 2件を1件に畳む。
 *
 * ローダーは和集合だが、片方が「全プラットフォーム」（空配列）なら全体に倒す。
 * バージョンも同様で、対象が割れたら特定のバージョン限定ではなくなるため null にする。
 */
const foldEntry = (base: DependencyEntry, next: DependencyEntry): DependencyEntry => {
  const allPlatforms = base.loaders.length === 0 || next.loaders.length === 0;
  const sameVersion = base.versionId === next.versionId;
  return {
    ...base,
    loaders: allPlatforms ? [] : [...new Set([...base.loaders, ...next.loaders])],
    versionId: sameVersion ? base.versionId : null,
    versionNumber: sameVersion ? base.versionNumber : null,
  };
};

/**
 * 依存関係の一覧を表示用にまとめる。並び順は最初に現れた順を保つ。
 */
export function mergeDependencyEntries(entries: DependencyEntry[]): DependencyEntry[] {
  const merged = new Map<string, DependencyEntry>();

  for (const entry of entries) {
    const key = mergeKey(entry);
    const current = merged.get(key);
    merged.set(key, current ? foldEntry(current, entry) : entry);
  }

  return [...merged.values()];
}

/**
 * 被依存の一覧を表示用にまとめる。
 * 相手プロジェクトが複数バージョンでこちらを要求していても1件に見せる。
 */
export function mergeDependentEntries<T extends DependentEntry>(entries: T[]): T[] {
  const merged = new Map<string, T>();

  for (const entry of entries) {
    const key = mergeKey(entry);
    if (!merged.has(key)) merged.set(key, entry);
  }

  return [...merged.values()];
}
