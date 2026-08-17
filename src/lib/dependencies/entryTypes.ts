import type { DependencyType } from "@/lib/dependencies/types";

/** 依存の適用範囲。バージョン限定にするか、どのプラットフォームに要るか */
export type DependencyScope = {
  /** 指定するとそのバージョン限定の依存になる。省略時はプロジェクト全体 */
  versionId?: string | null;
  /** 依存が要るプラットフォーム。空なら全プラットフォーム */
  loaders?: string[];
};

/** 依存関係カードに出す最小限のプロジェクト情報。存在しない外部依存も同じ形で表す */
export interface DependencyProjectSummary {
  id: string;
  slug: string;
  title: string;
  iconUrl: string | null;
}

/** 依存関係 1 件の表示用の形。バージョン限定かどうかも持つ */
export type DependencyEntry = {
  id: string;
  dependencyType: DependencyType;
  project: DependencyProjectSummary;
  externalUrl: string | null;
  externalName: string | null;
  /** バージョン限定の依存なら対象バージョンID。null ならプロジェクト全体 */
  versionId: string | null;
  /** バージョン限定の依存の表示用バージョン番号 */
  versionNumber: string | null;
  /** 依存が要るプラットフォーム。空なら全プラットフォーム */
  loaders: string[];
};
