"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { getDatabase } from "@/lib/db";
import { projects, projectTags, projectMembers, users, versions } from "@/db/schema";
import { createProjectSchema, updateProjectSchema } from "@/lib/validations";
import { createId } from "@paralleldrive/cuid2";
import { eq, desc, and, like, inArray, sql, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// ─── プロジェクト作成 ─────────────────────────────────────────────────────────

/**
 * 新しいプロジェクト（Mod/Plugin）を作成する Server Action
 * @param formData 送信されたフォームデータ (name, summary, type, description 等)
 * @returns { success: boolean, slug: string } または { error: Record<string, string[]> }
 * @throws Unauthorized ログインしていない場合
 */
export async function createProject(formData: FormData) {
  const { db, session } = await getAuthenticatedDb();

  const raw = {
    name:        formData.get("name"),
    slug:        formData.get("slug"),
    description: formData.get("description"),
    type:        formData.get("type"),
    license:     formData.get("license"),
    sourceUrl:   formData.get("sourceUrl"),
    links:       formData.get("links"),
    tags:        formData.getAll("tags"),
  };

  const parsed = createProjectSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { name, slug, description, type, license, sourceUrl, links, tags } = parsed.data;
  const id = createId();

  // スラッグの重複チェック
  const existingProject = await db.select().from(projects).where(eq(projects.slug, slug)).get();
  if (existingProject) {
    return { error: { slug: ["このスラッグは既に他のプロジェクトで使用されています。"] } };
  }

  await db.insert(projects).values({
    id,
    slug,
    name,
    description,
    type,
    license,
    sourceUrl:  sourceUrl || null,
    links:      links || null,
    iconUrl:    formData.get("iconUrl") as string | null,
    authorId:   session.user.id,
    status:     "draft",
  }).run();

  if (tags.length > 0) {
    await db.insert(projectTags).values(
      tags.map((tag) => ({ projectId: id, tag }))
    ).run();
  }

  revalidatePath("/projects");
  redirect(`/projects/${slug}`);
}

// ─── プロジェクト更新 ─────────────────────────────────────────────────────────

/**
 * 既存のプロジェクト情報を更新する Server Action
 * @param slug 更新対象プロジェクトのSlug
 * @param formData 送信されたフォームデータ
 * @returns { success: boolean } または { error: Record<string, string[]> }
 * @throws Unauthorized ログインしていない場合
 * @throws Forbidden プロジェクトの作者ではない、または管理者権限がない場合
 */
export async function updateProject(projectId: string, formData: FormData) {
  const { db, session } = await getAuthenticatedDb();

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .get();

  if (!project) throw new Error("Project not found");

  const member = await db.select().from(projectMembers).where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, session.user.id))).get();
  
  if (project.authorId !== session.user.id && !member && session.user.role !== "admin") {
    throw new Error("Forbidden");
  }

  const raw = {
    name:        formData.get("name"),
    slug:        formData.get("slug"),
    description: formData.get("description"),
    type:        formData.get("type"),
    license:     formData.get("license"),
    sourceUrl:   formData.get("sourceUrl"),
    links:       formData.get("links"),
    status:      formData.get("status"),
    tags:        formData.getAll("tags"),
  };

  const parsed = updateProjectSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { tags, ...fields } = parsed.data;

  // スラッグが変更された場合の重複チェック
  if (fields.slug && fields.slug !== project.slug) {
    const existingSlug = await db.select().from(projects).where(eq(projects.slug, fields.slug)).get();
    if (existingSlug) {
      return { error: { slug: ["このスラッグは既に他のプロジェクトで使用されています。"] } };
    }
  }

  await db
    .update(projects)
    .set({
      ...fields,
      sourceUrl: fields.sourceUrl || null,
      links: fields.links || null,
      iconUrl:   (formData.get("iconUrl") as string) || project.iconUrl,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, project.id))
    .run();

  if (tags !== undefined) {
    await db.delete(projectTags).where(eq(projectTags.projectId, project.id)).run();
    if (tags.length > 0) {
      await db.insert(projectTags).values(
        tags.map((tag) => ({ projectId: project.id, tag }))
      ).run();
    }
  }

  revalidatePath(`/projects/${fields.slug ?? project.slug}`);
  return { success: true };
}

// ─── プロジェクト取得（一覧・検索） ─────────────────────────────────────────────

/**
 * 公開中のプロジェクト一覧を取得する Server Action
 * ページネーション、検索クエリ、フィルタリングに対応
 * @param params 検索・フィルタ条件
 * @param params.q 検索文字列（名前、概要にマッチ）
 * @param params.type プロジェクト種別（mod / plugin）
 * @param params.authorId 特定の作者のプロジェクトのみ取得する場合に指定
 * @param params.limit 1ページあたりの取得件数
 * @param params.offset 取得開始位置
 * @param params.sort 並び順
 * @param params.loader ローダーフィルター
 * @param params.mcVersion MCバージョンフィルター
 * @returns projects配列
 */
export async function getProjects(params: {
  q?:    string;
  types?: string[];
  authorId?: string;
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
}) {
  const db = await getDatabase();
  const { 
    q, types, authorId, limit = 20, offset = 0, sort = "updated", 
    loaders, mcVersions, tags,
    searchMode = "OR", includeDesc = true, includeTags = true, includeAuthor = true
  } = params;

  const conditions = [];
  if (authorId) {
    conditions.push(eq(projects.authorId, authorId));
  } else {
    // 検索・一覧表示には「public」のみ表示（unlisted, private, draft は表示しない）
    conditions.push(eq(projects.status, "public"));
  }
  
  if (types && types.length > 0) {
    conditions.push(inArray(projects.type, types as ("mod" | "plugin")[]));
  }

  if (q) {
    const keywords = q.trim().split(/\s+/).filter(Boolean);
    if (keywords.length > 0) {
      const keywordConditions = keywords.map(kw => {
        const kwConds = [like(projects.name, `%${kw}%`)];
        if (includeDesc) {
          kwConds.push(like(projects.description, `%${kw}%`));
        }
        if (includeAuthor) {
          kwConds.push(like(users.username, `%${kw}%`));
          kwConds.push(like(users.displayName, `%${kw}%`));
        }
        if (includeTags) {
          kwConds.push(sql`${projects.id} IN (SELECT project_id FROM project_tags WHERE tag LIKE ${`%${kw}%`})`);
        }
        return or(...kwConds);
      });

      if (searchMode === "AND") {
        conditions.push(and(...keywordConditions)!);
      } else {
        conditions.push(or(...keywordConditions)!);
      }
    }
  }

  if (loaders && loaders.length > 0) {
    conditions.push(
      sql`${projects.id} IN (SELECT project_id FROM versions WHERE id IN (SELECT version_id FROM version_loaders WHERE ${inArray(sql`loader`, loaders)}))`
    );
  }

  if (mcVersions && mcVersions.length > 0) {
    conditions.push(
      sql`${projects.id} IN (SELECT project_id FROM versions WHERE id IN (SELECT version_id FROM version_mc_versions WHERE ${inArray(sql`mc_version`, mcVersions)}))`
    );
  }

  if (tags && tags.length > 0) {
    conditions.push(
      sql`${projects.id} IN (SELECT project_id FROM project_tags WHERE ${inArray(sql`tag`, tags)})`
    );
  }

  let orderByExpr = desc(projects.updatedAt);
  if (sort === "downloads") orderByExpr = desc(projects.downloads);
  if (sort === "newest") orderByExpr = desc(projects.createdAt);

  let rows;
  try {
    // プロジェクトと著者の情報をJOINして取得
    rows = await db
      .select({
        project: projects,
        author: {
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        }
      })
      .from(projects)
      .leftJoin(users, eq(projects.authorId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderByExpr)
      .limit(limit)
      .offset(offset)
      .all();
  } catch (err: any) {
    console.error("D1 getProjects Error:");
    console.error("Message:", err.message);
    if (err.cause) console.error("Cause:", err.cause);
    throw err;
  }

  // 各プロジェクトのタグを取得
  const projectIds = rows.map((r) => r.project.id);
  let tagsData: { projectId: string; tag: string }[] = [];
  if (projectIds.length > 0) {
    tagsData = await db
      .select()
      .from(projectTags)
      .where(inArray(projectTags.projectId, projectIds))
      .all();
  }

  return rows.map((row) => ({
    ...row.project,
    authorUsername: row.author?.username,
    authorDisplayName: row.author?.displayName ?? row.author?.username,
    authorAvatarUrl: row.author?.avatarUrl,
    tags: tagsData.filter((t) => t.projectId === row.project.id).map((t) => t.tag),
  }));
}

/**
 * プロジェクトのSlugから詳細情報を取得する Server Action
 * @param slug プロジェクトの一意な識別子
 * @returns プロジェクトの詳細データ（作者情報やバージョン情報を含む）。存在しない場合は null。
 */
export async function getProjectBySlug(slug: string) {
  const db = await getDatabase();

  const row = await db
    .select({
      project: projects,
      author: {
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      }
    })
    .from(projects)
    .leftJoin(users, eq(projects.authorId, users.id))
    .where(eq(projects.slug, slug))
    .get();

  if (!row) return null;

  const tagsRows = await db.select().from(projectTags).where(eq(projectTags.projectId, row.project.id)).all();
  const versionsRows = await db.select().from(versions).where(eq(versions.projectId, row.project.id)).orderBy(desc(versions.createdAt)).all();

  return {
    ...row.project,
    author: row.author,
    tags: tagsRows.map((t) => t.tag),
    versions: versionsRows,
  };
}

// ─── プロジェクトのアイコン更新 ───────────────────────────────────────────────

export async function updateProjectIcon(projectId: string, iconUrl: string) {
  const { db, session } = await getAuthenticatedDb();

  const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project) throw new Error("Not found");

  const member = await db.select().from(projectMembers).where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, session.user.id))).get();
  if (project.authorId !== session.user.id && !member && session.user.role !== "admin") {
    throw new Error("Forbidden");
  }

  await db.update(projects).set({ iconUrl, updatedAt: new Date() }).where(eq(projects.id, projectId));
  revalidatePath(`/[locale]/projects/[slug]`, "page");
  return { success: true };
}

// ─── オーナー権限の譲渡 ───────────────────────────────────────────────────────

export async function transferOwnership(projectId: string, newOwnerId: string) {
  const { db, session } = await getAuthenticatedDb();

  const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project) throw new Error("Not found");

  if (project.authorId !== session.user.id && session.user.role !== "admin") {
    throw new Error("Forbidden: Only owner can transfer ownership");
  }

  // Ensure new owner exists
  const targetUser = await db.select().from(users).where(eq(users.id, newOwnerId)).get();
  if (!targetUser) throw new Error("User not found");

  // Transfer ownership
  await db.update(projects).set({ authorId: newOwnerId, updatedAt: new Date() }).where(eq(projects.id, projectId));

  // The new owner might have been a member, we can safely remove them from members if they are
  await db.delete(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, newOwnerId)));

  revalidatePath(`/[locale]/projects/[slug]/edit`, "page");
  return { success: true };
}
