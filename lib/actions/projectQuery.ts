import { getDatabase } from "@/lib/db";
import { posts, projects, projectTags, users, userProfiles, versions } from "@/db/schema";
import { eq, desc, and, or, sql, isNull, getTableColumns } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { buildProjectSearchConditions, resolveProjectOrderBy } from "@/lib/queries/projectSearch";
import { mapProjectRow } from "@/lib/queries/projectRow";
import { toProjectPost } from "@/lib/queries/postRow";

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
};

/**
 * 公開中のプロジェクト一覧を取得する Server Action。
 * ページネーション、検索クエリ、ローダーやMCバージョンによるフィルタリングに対応しています。
 */
export const getProjects = async (params: GetProjectsParams) => {
  const db = await getDatabase();
  const {
    limit = 20, offset = 0, sort = "updated",
    includeExtDl = false
  } = params;

  const conditions = buildProjectSearchConditions(params);
  const orderByExpr = resolveProjectOrderBy(sort, includeExtDl);

  try {
    // 一覧では本文全体を運ばず先頭のみ返す。body は posts 側にある
    const { body, ...restPosts } = getTableColumns(posts);
    const rows = await db
      .select({
        project: {
          ...restPosts,
          // projects.id は posts.id と同じ値なので、後勝ちで上書きされても問題ない
          ...getTableColumns(projects),
          body: sql<string>`SUBSTR(${posts.body}, 1, 1200) || CASE WHEN LENGTH(${posts.body}) > 1200 THEN '...' ELSE '' END`,
          tagsJson: sql<string>`(SELECT json_group_array(tag) FROM project_tags WHERE project_id = posts.id)`
        },
        author: {
          username: userProfiles.username,
          displayName: userProfiles.displayName,
          avatarUrl: userProfiles.avatarUrl,
        }
      })
      .from(posts)
      .innerJoin(projects, eq(projects.id, posts.id))
      .leftJoin(users, eq(posts.authorId, users.id))
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderByExpr)
      .limit(limit)
      .offset(offset)
      .all();

    return rows.map(mapProjectRow);
  } catch (err: unknown) {
    console.error("D1 getProjects Error:");
    if (err instanceof Error) {
      console.error("Message:", err.message);
      if ("cause" in err) console.error("Cause:", err.cause);
    }
    throw err;
  }
};

/**
 * getProjects と同じ検索条件で、該当件数のみを取得する Server Action。
 */
export const getProjectCount = async (params: GetProjectsParams) => {
  const db = await getDatabase();
  const conditions = buildProjectSearchConditions(params);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(posts)
    .innerJoin(projects, eq(projects.id, posts.id))
    .leftJoin(users, eq(posts.authorId, users.id))
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .get();

  return countResult?.count || 0;
};

/**
 * getProjects に加えて、ページネーション用の総件数も取得する Server Action。
 * 総件数の COUNT クエリが追加で走るため、必要な場合のみ使用してください。
 */
export const getProjectsWithCount = async (params: GetProjectsParams) => {
  const [data, totalCount] = await Promise.all([
    getProjects(params),
    getProjectCount(params),
  ]);

  return { data, totalCount };
};

/**
 * プロジェクトのSlugまたは以前のSlugから、詳細情報（作者、タグ、最新バージョン）を取得する Server Action。
 */
export const getProjectBySlug = async (slug: string) => {
  const db = await getDatabase();

  // 元になった Idea のタイトルも posts にあるため、posts をもう一度別名で join する
  const sourceIdeaPost = alias(posts, "source_idea_post");

  const row = await db
    .select({
      posts: posts,
      projects: projects,
      author: {
        username: userProfiles.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
      },
      sourceIdeaTitle: sourceIdeaPost.title,
    })
    .from(posts)
    .innerJoin(projects, eq(projects.id, posts.id))
    .leftJoin(users, eq(posts.authorId, users.id))
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
    .leftJoin(sourceIdeaPost, eq(projects.sourceIdeaId, sourceIdeaPost.id))
    .where(and(
      eq(posts.kind, "project"),
      or(eq(posts.slug, slug), eq(posts.previousSlug, slug)),
    ))
    .get();

  if (!row) return null;

  const project = toProjectPost(row);
  const tagsRows = await db.select().from(projectTags).where(eq(projectTags.projectId, project.id)).all();
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
  }).from(versions).where(and(eq(versions.projectId, project.id), isNull(versions.archivedAt))).orderBy(desc(versions.createdAt)).limit(20).all();

  return {
    ...project,
    author: row.author,
    sourceIdeaTitle: row.sourceIdeaTitle,
    tags: tagsRows.map((t) => t.tag),
    versions: versionsRows,
    redirectSlug: project.slug !== slug ? project.slug : undefined,
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
    .from(posts)
    .innerJoin(projects, eq(projects.id, posts.id))
    .where(and(eq(posts.authorId, authorId), eq(posts.visibility, "public")))
    .get();

  return {
    totalProjects: result?.totalProjects || 0,
    totalDownloads: result?.totalDownloads || 0,
    nativeDownloads: result?.nativeDownloads || 0,
    modrinthDownloads: result?.modrinthDownloads || 0,
    curseforgeDownloads: result?.curseforgeDownloads || 0,
  };
};
