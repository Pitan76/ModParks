/**
 * 公開API v1 / v2 で形が完全に一致する型。
 *
 * v1 と v2 はワイヤ形式が異なる（v1 は name/description、v2 は title/body/kind）ため、
 * プロジェクトやアイデアの型は共有できない。ここに置くのは、両者で 1 バイトも
 * 差の無い型だけに限る。差が生まれた時点で、共有をやめて各バージョン側へ戻すこと。
 */

export interface ApiUser {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio?: string | null;
  githubUsername?: string | null;
}

/** バージョンに適用される依存関係 1 件 */
export interface ApiVersionDependency {
  /** required / optional / incompatible / embedded */
  dependencyType: string;
  /** ModParks 内のプロジェクトへの依存ならスラッグ。外部依存なら null */
  projectSlug: string | null;
  projectTitle: string | null;
  externalUrl: string | null;
  externalName: string | null;
  /** true ならこのバージョン限定、false ならプロジェクト全体の依存 */
  versionScoped: boolean;
  /** 依存が要るプラットフォーム。空ならすべてのプラットフォームで要る */
  loaders: string[];
}

export interface ApiVersion {
  id: string;
  versionNumber: string;
  changelog: string;
  releaseChannel: string;
  downloads: number;
  fileUrl: string;
  fileName: string;
  fileSize: number | null;
  fileSha256: string | null;
  loaders: string[];
  mcVersions: string[];
  createdAt: number;
  /** このバージョンに効く依存関係（バージョン限定 + プロジェクト全体） */
  dependencies: ApiVersionDependency[];
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    limit: number;
    offset: number;
    count: number;
  };
}
