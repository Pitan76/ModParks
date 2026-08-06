/**
 * 公開API v2 の型。
 *
 * 命名はドメイン層（types/post.ts の ProjectPost / IdeaPost）とそのまま揃える。
 * DB の posts / projects 分割はここに持ち込まない - レスポンスは平坦な1オブジェクト。
 * 詳細は docs-md/DESIGN.md の「公開APIも同じ名前に揃える」を参照。
 */

import type { ContentType } from "@/lib/data/projectTypes";
import type { ApiUser } from "@/types/apiShared";

export type { ApiUser, ApiVersion, PaginatedResponse } from "@/types/apiShared";

/** Project / Idea に共通するフィールド */
export interface ApiPost {
  id: string;
  kind: "project" | "idea";
  slug: string;
  title: string;
  body: string;
  bodyFormat: "markdown" | "plaintext" | "pukiwiki";
  createdAt: number;
  updatedAt: number;
  author: ApiUser;
}

export interface ApiProject extends ApiPost {
  kind: "project";
  type: ContentType;
  license: string;
  iconUrl: string | null;
  downloads: Record<string, number>;
  tags: string[];
}

export interface ApiIdea extends ApiPost {
  kind: "idea";
  status: "open" | "in_progress" | "fulfilled";
}

/**
 * 作者・共同編集者・管理者にのみ返す限定フィールド。
 * ApiProject を継承して足す。積み上げ方式（削らずに足す）で組み立てること。
 */
export interface ApiProjectPrivate extends ApiProject {
  visibility: "draft" | "public" | "unlisted" | "private";
  githubRepo: string | null;
  discordWebhookUrl: string | null;
  modrinthId: string | null;
  curseforgeId: string | null;
  sourceIdeaId: string | null;
  recipeNamespaces: string[];
  commentsEnabled: boolean;
  recipesEnabled: boolean;
}

export interface ApiIdeaPrivate extends ApiIdea {
  visibility: "draft" | "public" | "unlisted" | "private";
}

export interface ApiComment {
  id: string;
  content: string;
  contentFormat: "markdown" | "plaintext" | "pukiwiki";
  parentId: string | null;
  author: ApiUser;
  createdAt: number;
  updatedAt: number;
}

export interface ApiDependency {
  id: string;
  dependencyType: "required" | "optional" | "incompatible" | "embedded";
  project: {
    id: string;
    slug: string;
    title: string;
    iconUrl: string | null;
  };
}

export interface ApiProjectDetail extends ApiProject {
  dependencies: ApiDependency[];
  dependents: ApiDependency[];
}

export interface ApiProjectPrivateDetail extends ApiProjectPrivate {
  dependencies: ApiDependency[];
  dependents: ApiDependency[];
}
