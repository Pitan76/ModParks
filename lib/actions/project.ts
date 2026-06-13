"use server";

import { auth } from "@/lib/auth";
import { getDb, getD1 } from "@/lib/db";
import { projects, projectTags, versions } from "@/db/schema";
import { createProjectSchema, updateProjectSchema } from "@/lib/validations";
import { createId } from "@paralleldrive/cuid2";
import { eq, and, like, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// ─── プロジェクト作成 ─────────────────────────────────────────────────────────

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

export async function updateProject(projectId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const d1 = await getD1();
  const db = getDb(d1);

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
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

  await db
    .update(projects)
    .set({
      ...fields,
      sourceUrl: fields.sourceUrl || null,
      iconUrl:   (formData.get("iconUrl") as string) || project.iconUrl,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId))
    .run();

  if (tags !== undefined) {
    await db.delete(projectTags).where(eq(projectTags.projectId, projectId)).run();
    if (tags.length > 0) {
      await db.insert(projectTags).values(
        tags.map((tag) => ({ projectId, tag }))
      ).run();
    }
  }

  revalidatePath(`/projects/${fields.slug ?? project.slug}`);
  return { success: true };
}

// ─── プロジェクト取得（一覧・検索） ─────────────────────────────────────────────

export async function getProjects(params: {
  q?:    string;
  type?: "mod" | "plugin";
  limit?: number;
  offset?: number;
}) {
  const d1 = await getD1();
  const db = getDb(d1);
  const { q, type, limit = 20, offset = 0 } = params;

  const conditions = [eq(projects.status, "published")];
  if (type) conditions.push(eq(projects.type, type));
  if (q)    conditions.push(like(projects.name, `%${q}%`));

  const rows = await db
    .select()
    .from(projects)
    .where(and(...conditions))
    .orderBy(desc(projects.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  return rows;
}
