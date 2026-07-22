import { getDatabase } from "@/lib/db";
import { projects, projectTags, users, userProfiles, versions, ideas } from "@/db/schema";
import { eq, desc, and, or, sql, isNull, getTableColumns } from "drizzle-orm";
import { buildProjectSearchConditions, resolveProjectOrderBy } from "@/lib/queries/projectSearch";

type GetProjectsParams = {
  q?: string;
  types?: string[];
  authorId?: string;
  authorUsername?: string;
  limit?: number;
  offset?: number;
  sort?: "downloads" | "newest" | "updated";
  loaders?: string[];
  mcVersions?: string[];
  tags?: string[];
  searchMode?: "AND" | "OR";
  includeDesc?: boolean;
  includeTags?: boolean;
  includeAuthor?: boolean;
  includeExtDl?: boolean;
  calculateTotal?: boolean;
};

/**
 * 公開中のプロジェクト一覧を取得する Server Action。
 * ページネーション、検索クエリ、ローダーやMCバージョンによるフィルタリングに対応しています。
 */
export const getProjects = async (params: GetProjectsParams) => {
  const db = await getDatabase();
  const {
    limit = 20, offset = 0, sort = "updated",
    includeExtDl = false, calculateTotal = false
  } = params;

  const conditions = buildProjectSearchConditions(params);
  const orderByExpr = resolveProjectOrderBy(sort, includeExtDl);

  let rows;
  let totalCount = 0;
  try {
    if (calculateTotal) {
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(projects)
        .leftJoin(users, eq(projects.authorId, users.id))
        .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .get();
      totalCount = countResult?.count || 0;
    }

    const { description, ...restProjects } = getTableColumns(projects);
    rows = await db
      .select({
        project: {
          ...restProjects,
          description: sql<string>`SUBSTR(${projects.description}, 1, 1200) || CASE WHEN LENGTH(${projects.description}) > 1200 THEN '...' ELSE '' END`,
          tagsJson: sql<string>`(SELECT json_group_array(tag) FROM project_tags WHERE project_id = projects.id)`
        },
        author: {
          username: userProfiles.username,
          displayName: userProfiles.displayName,
          avatarUrl: userProfiles.avatarUrl,
        }
      })
      .from(projects)
      .leftJoin(users, eq(projects.authorId, users.id))
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderByExpr)
      .limit(limit)
      .offset(offset)
      .all();
  } catch (err: unknown) {
    console.error("D1 getProjects Error:");
    if (err instanceof Error) {
      console.error("Message:", err.message);
      if ("cause" in err) console.error("Cause:", err.cause);
    }
    throw err;
  }

  const data = rows.map((row) => {
    let parsedTags: string[] = [];
    if (row.project.tagsJson) {
      try {
        const t = JSON.parse(row.project.tagsJson);
        if (Array.isArray(t) && t.length > 0 && t[0] !== null) parsedTags = t;
      } catch (e) {}
    }
    
    const { tagsJson, ...projectData } = row.project;

    return {
      ...projectData,
      authorUsername: row.author?.username,
      authorDisplayName: row.author?.displayName ?? row.author?.username,
      authorAvatarUrl: row.author?.avatarUrl,
      tags: parsedTags,
    };
  });

  return { data, totalCount };
};

/**
 * プロジェクトのSlugまたは以前のSlugから、詳細情報（作者、タグ、最新バージョン）を取得する Server Action。
 */
export const getProjectBySlug = async (slug: string) => {
  const db = await getDatabase();

  const row = await db
    .select({
      project: projects,
      author: {
        username: userProfiles.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
      },
      sourceIdeaTitle: ideas.title,
    })
    .from(projects)
    .leftJoin(users, eq(projects.authorId, users.id))
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
    .leftJoin(ideas, eq(projects.sourceIdeaId, ideas.id))
    .where(or(eq(projects.slug, slug), eq(projects.previousSlug, slug)))
    .get();

  if (!row) return null;

  const tagsRows = await db.select().from(projectTags).where(eq(projectTags.projectId, row.project.id)).all();
  const versionsRows = await db.select({
    id: versions.id,
    versionNumber: versions.versionNumber,
    releaseChannel: versions.releaseChannel,
    mcVersions: versions.mcVersions,
    loaders: versions.loaders,
    fileName: versions.fileName,
    fileSize: versions.fileSize,
    downloads: versions.downloads,
    createdAt: versions.createdAt,
    projectId: versions.projectId,
    fileUrl: versions.fileUrl,
    fileSha256: versions.fileSha256,
  }).from(versions).where(and(eq(versions.projectId, row.project.id), isNull(versions.archivedAt))).orderBy(desc(versions.createdAt)).limit(20).all();

  return {
    ...row.project,
    author: row.author,
    sourceIdeaTitle: row.sourceIdeaTitle,
    tags: tagsRows.map((t) => t.tag),
    versions: versionsRows,
    redirectSlug: row.project.slug !== slug ? row.project.slug : undefined,
  };
};

/**
 * 指定したユーザーの全公開プロジェクトの総数、ダウンロード数統計（内製・外部合算含む）を取得する Server Action。
 */
export const getUserProjectStats = async (authorId: string) => {
  const db = await getDatabase();
  
  const result = await db
    .select({
      totalProjects: sql<number>`count(*)`,
      nativeDownloads: sql<number>`sum(${projects.downloads})`,
      totalDownloads: sql<number>`sum(${projects.totalDownloads})`,
      modrinthDownloads: sql<number>`sum(COALESCE(json_extract(${projects.externalDownloads}, '$.modrinth'), 0))`,
      curseforgeDownloads: sql<number>`sum(COALESCE(json_extract(${projects.externalDownloads}, '$.curseforge'), 0))`,
    })
    .from(projects)
    .where(and(eq(projects.authorId, authorId), eq(projects.status, "public")))
    .get();

  return {
    totalProjects: result?.totalProjects || 0,
    totalDownloads: result?.totalDownloads || 0,
    nativeDownloads: result?.nativeDownloads || 0,
    modrinthDownloads: result?.modrinthDownloads || 0,
    curseforgeDownloads: result?.curseforgeDownloads || 0,
  };
};
