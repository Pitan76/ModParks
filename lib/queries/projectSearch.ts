import { projects, userProfiles } from "@/db/schema";
import { eq, desc, and, or, like, sql, inArray, type SQL } from "drizzle-orm";

type ContentType = "mod" | "plugin" | "resourcepack" | "datapack" | "shader" | "modpack";

export interface ProjectSearchParams {
  q?: string;
  types?: string[];
  authorId?: string;
  authorUsername?: string;
  loaders?: string[];
  mcVersions?: string[];
  tags?: string[];
  searchMode?: "AND" | "OR";
  includeDesc?: boolean;
  includeTags?: boolean;
  includeAuthor?: boolean;
}

/**
 * getProjects の WHERE 条件を組み立てる純粋関数。
 * 権限/種別フィルタ、キーワード検索（名前・説明・作者・タグ）、
 * ローダー / MCバージョン / タグの EXISTS フィルタを構築する。
 */
export function buildProjectSearchConditions(params: ProjectSearchParams): SQL[] {
  const {
    q, types, authorId, authorUsername, loaders, mcVersions, tags,
    searchMode = "OR", includeDesc = true, includeTags = true, includeAuthor = true,
  } = params;

  const conditions: SQL[] = [];

  if (authorId) {
    conditions.push(eq(projects.authorId, authorId));
  } else if (authorUsername) {
    conditions.push(eq(userProfiles.username, authorUsername));
    conditions.push(eq(projects.status, "public"));
  } else {
    // 検索・一覧表示には「public」のみ表示（unlisted, private, draft は表示しない）
    conditions.push(eq(projects.status, "public"));
  }

  if (types && types.length > 0) {
    conditions.push(inArray(projects.type, types as ContentType[]));
  }

  if (q) {
    const keywords = q.trim().split(/\s+/).filter(Boolean);
    if (keywords.length > 0) {
      const keywordConditions = keywords.map((kw) => {
        const kwConds: SQL[] = [like(projects.name, `%${kw}%`)];
        if (includeDesc) {
          kwConds.push(like(projects.description, `%${kw}%`));
        }
        if (includeAuthor) {
          kwConds.push(like(userProfiles.username, `%${kw}%`));
          kwConds.push(like(userProfiles.displayName, `%${kw}%`));
        }
        if (includeTags) {
          kwConds.push(sql`${projects.id} IN (SELECT project_id FROM project_tags WHERE tag LIKE ${`%${kw}%`})`);
        }
        return or(...kwConds)!;
      });

      conditions.push(searchMode === "AND" ? and(...keywordConditions)! : or(...keywordConditions)!);
    }
  }

  if (loaders && loaders.length > 0) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM versions v JOIN version_loaders vl ON v.id = vl.version_id WHERE v.project_id = ${projects.id} AND ${inArray(sql`vl.loader`, loaders)})`
    );
  }

  if (mcVersions && mcVersions.length > 0) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM versions v JOIN version_mc_versions vmc ON v.id = vmc.version_id WHERE v.project_id = ${projects.id} AND ${inArray(sql`vmc.mc_version`, mcVersions)})`
    );
  }

  if (tags && tags.length > 0) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM project_tags pt WHERE pt.project_id = ${projects.id} AND ${inArray(sql`pt.tag`, tags)})`
    );
  }

  return conditions;
}

/** ソート指定から order by 式を解決する */
export function resolveProjectOrderBy(sort: "downloads" | "newest" | "updated", includeExtDl: boolean): SQL {
  if (sort === "downloads") {
    return includeExtDl ? desc(projects.totalDownloads) : desc(projects.downloads);
  }
  if (sort === "newest") return desc(projects.createdAt);
  return desc(projects.updatedAt);
}
