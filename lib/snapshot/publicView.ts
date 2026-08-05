/**
 * スナップショットに載せる公開情報の定義。
 *
 * バックアップの中身をそのまま出すと、非公開プロジェクト・メール・
 * Webhook URL などが混ざる。列を足したときに事故らないよう、
 * 出す項目をホワイトリストで明示する（除外リストにはしない）。
 */

/** 一覧に載せる軽量な形。詳細を引かずに描画できる範囲に絞る */
export type PublicProjectSummary = {
  slug: string;
  title: string;
  type: string;
  iconUrl: string | null;
  downloads: number;
  authorName: string;
  updatedAt: number;
};

/** 詳細。README と配布先を含む */
export type PublicProjectDetail = PublicProjectSummary & {
  body: string;
  bodyFormat: string;
  license: string;
  sourceUrl: string | null;
  issueTrackerUrl: string | null;
  links: string | null;
  createdAt: number;
  versions: PublicVersion[];
};

export type PublicVersion = {
  versionNumber: string;
  loaders: string[];
  mcVersions: string[];
  /** 外部配布先。ModParks 経由の配布が止まっていても辿れるようにする */
  externalUrl: string | null;
  releasedAt: number;
};

export type PublicAuthor = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  projectSlugs: string[];
};

export type SnapshotManifest = {
  /** 出力形式のバージョン。読み手が互換性を判断できるようにする */
  schemaVersion: number;
  generatedAt: number;
  projectCount: number;
  authorCount: number;
};

/** 出力形式のバージョン。破壊的変更時に上げる */
export const SNAPSHOT_SCHEMA_VERSION = 1;

/**
 * スナップショットに含めてよい公開範囲。
 *
 * unlisted は「URL を知っていれば見られる」であり、一覧には出さない。
 * 検索インデックスにも載せないため、ここでは public のみを対象にする。
 */
export const SNAPSHOT_VISIBILITY = "public";
