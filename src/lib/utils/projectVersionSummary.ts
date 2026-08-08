import { compactMcVersions, toStringArray } from "@/lib/utils/format";

/** サイドバーの要約に必要な最小限のバージョン情報 */
export type SummarizableVersion = {
  mcVersions: string | string[];
  loaders:    string | string[];
};

export type ProjectVersionSummary = {
  /** 全バージョンを通した対応MCバージョン（レンジ圧縮済み・新しい順） */
  mcVersions: string[];
  /** 全バージョンを通した対応ローダー */
  loaders:    string[];
};

/**
 * プロジェクト配下の全バージョンから、対応MCバージョンとローダーを集約します。
 * MCバージョンは {@link compactMcVersions} で 1.21.x のようにまとめます。
 */
export function summarizeProjectVersions(versions: SummarizableVersion[]): ProjectVersionSummary {
  const mcSet = new Set<string>();
  const loaderSet = new Set<string>();

  for (const version of versions) {
    toStringArray(version.mcVersions).forEach((mc) => mcSet.add(mc));
    toStringArray(version.loaders).forEach((loader) => loaderSet.add(loader));
  }

  return {
    mcVersions: compactMcVersions([...mcSet]),
    loaders:    [...loaderSet].sort((a, b) => a.localeCompare(b)),
  };
}
