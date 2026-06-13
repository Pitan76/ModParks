"use server";

import { auth } from "@/lib/auth";
import { getDb, getD1 } from "@/lib/db";
import { projects, projectTags, versions, users } from "@/db/schema";
import { createProjectSchema, updateProjectSchema } from "@/lib/validations";
import { createId } from "@paralleldrive/cuid2";
import { eq, and, like, desc } from "drizzle-orm";
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
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const raw = {
    name:        formData.get("name"),
    slug:        formData.get("slug"),
    description: formData.get("description"),
    type:        formData.get("type"),
    license:     formData.get("license"),
    sourceUrl:   formData.get("sourceUrl"),
    tags:        formData.getAll("tags"),
  };

  const parsed = createProjectSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { name, slug, description, type, license, sourceUrl, tags } = parsed.data;
  const d1 = await getD1();
  const db = getDb(d1);
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
export async function updateProject(slug: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const d1 = await getD1();
  const db = getDb(d1);

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.slug, slug))
    .get();

  if (!project) throw new Error("Project not found");
  if (project.authorId !== session.user.id && session.user.role !== "admin") {
    throw new Error("Forbidden");
  }

  const raw = {
    name:        formData.get("name"),
    slug:        formData.get("slug"),
    description: formData.get("description"),
    type:        formData.get("type"),
    license:     formData.get("license"),
    sourceUrl:   formData.get("sourceUrl"),
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
 * @returns projects配列
 */
export async function getProjects(params: {
  q?:    string;
  type?: "mod" | "plugin";
  authorId?: string;
  limit?: number;
  offset?: number;
}) {
  const d1 = await getD1();
  const db = getDb(d1);
  const { q, type, authorId, limit = 20, offset = 0 } = params;

  const conditions = [];
  if (authorId) {
    conditions.push(eq(projects.authorId, authorId));
  } else {
    conditions.push(eq(projects.status, "published"));
  }
  
  // @ts-ignore
  if (type && type !== "all") conditions.push(eq(projects.type, type));
  if (q) conditions.push(like(projects.name, `%${q}%`));

  // プロジェクトと著者の情報をJOINして取得
  const rows = await db
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
    .orderBy(desc(projects.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  // 各プロジェクトのタグを取得
  const projectIds = rows.map((r) => r.project.id);
  let tagsData: { projectId: string; tag: string }[] = [];
  if (projectIds.length > 0) {
    // IN句の代わりにORを使うか、あるいは1つずつ取得（今回は簡易的に全タグ取得してフィルタ）
    // 本来は inArray() が使えますが、ここではシンプルに
    const tagsRows = await db.select().from(projectTags).all();
    tagsData = tagsRows.filter((t) => projectIds.includes(t.projectId));
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
  const d1 = await getD1();
  const db = getDb(d1);

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
