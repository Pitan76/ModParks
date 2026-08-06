/**
 * 公開API v1 の型。
 *
 * v2（types/api.ts）とはワイヤ形式が異なる。v1 は name/description を返し、
 * kind / bodyFormat を持たない。既存クライアントが依存しているため、
 * v2 に合わせて改名してはならない。共通部分は types/apiShared.ts を参照。
 */

import type { ContentType } from "@/lib/data/projectTypes";
import type { ApiUser } from "@/types/apiShared";

export type { ApiUser, ApiVersion, PaginatedResponse } from "@/types/apiShared";

export interface ApiProject {
  id: string;
  slug: string;
  name: string;
  description: string;
  iconUrl: string | null;
  type: ContentType;
  license: string;
  downloads: Record<string, number>;
  createdAt: number;
  updatedAt: number;
  author: ApiUser;
  tags: string[];
}

export interface ApiIdea {
  id: string;
  title: string;
  content: string;
  status: "open" | "in_progress" | "fulfilled";
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
    name: string;
    iconUrl: string | null;
  };
}

export interface ApiProjectDetail extends ApiProject {
  dependencies: ApiDependency[];
  dependents: ApiDependency[];
}
