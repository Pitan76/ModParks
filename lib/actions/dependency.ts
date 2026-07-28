"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { getDatabase } from "@/lib/db";
import { projectDependencies, posts, projects, projectMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recordDeletion } from "@/lib/backup/tombstone";
import { findProjectPostById, findProjectPostBySlug } from "@/lib/queries/post";

export type DependencyType = "required" | "optional" | "incompatible" | "embedded";

/** 依存関係カードに出す最小限のプロジェクト情報。存在しない外部依存も同じ形で表す */
export interface DependencyProjectSummary {
  id: string;
  slug: string;
  title: string;
  iconUrl: string | null;
}

/**
 * プロジェクトの依存関係を取得する
 */
export async function getProjectDependencies(projectId: string) {
  const db = await getDatabase();

  const deps = await db
    .select({
      id: projectDependencies.id,
      dependencyType: projectDependencies.dependencyType,
      targetPost: posts,
      targetProject: projects,
      externalUrl: projectDependencies.externalUrl,
      externalName: projectDependencies.externalName,
    })
    .from(projectDependencies)
    .leftJoin(projects, eq(projectDependencies.targetProjectId, projects.id))
    .leftJoin(posts, eq(posts.id, projects.id))
    .where(eq(projectDependencies.projectId, projectId))
    .all();

  return deps.map((d) => ({
    id: d.id,
    dependencyType: d.dependencyType as DependencyType,
    project: (d.targetPost
      ? { id: d.targetPost.id, slug: d.targetPost.slug, title: d.targetPost.title, iconUrl: d.targetProject?.iconUrl ?? null }
      : { id: d.id, slug: d.id, title: d.externalName || "Unknown External", iconUrl: null }) satisfies DependencyProjectSummary,
    externalUrl: d.externalUrl,
    externalName: d.externalName,
  }));
}

/**
 * このプロジェクトに依存しているプロジェクト（逆引き）を取得する
 */
export async function getProjectDependents(projectId: string) {
  const db = await getDatabase();

  const deps = await db
    .select({
      id: projectDependencies.id,
      dependencyType: projectDependencies.dependencyType,
      sourcePost: posts,
      sourceProject: projects,
    })
    .from(projectDependencies)
    .innerJoin(projects, eq(projectDependencies.projectId, projects.id))
    .innerJoin(posts, eq(posts.id, projects.id))
    .where(eq(projectDependencies.targetProjectId, projectId))
    .all();

  return deps.map((d) => ({
    id: d.id,
    dependencyType: d.dependencyType as DependencyType,
    project: {
      id: d.sourcePost.id,
      slug: d.sourcePost.slug,
      title: d.sourcePost.title,
      iconUrl: d.sourceProject.iconUrl,
    } satisfies DependencyProjectSummary,
  }));
}

/**
 * プロジェクトに依存関係を追加する（Slugで指定）
 */
export async function addProjectDependencyBySlug(projectId: string, targetSlug: string, dependencyType: DependencyType) {
  const { db, session } = await getAuthenticatedDb();

  const project = await findProjectPostById(db, projectId);
  if (!project) throw new Error("Project not found");

  const targetProject = await findProjectPostBySlug(db, targetSlug);
  if (!targetProject) throw new Error("Target project not found");

  if (projectId === targetProject.id) {
    throw new Error("Cannot depend on itself");
  }

  const member = await db.select().from(projectMembers).where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, session.user.id))).get();
  if (project.authorId !== session.user.id && !member && session.user.role !== "admin") {
    throw new Error("Forbidden");
  }

  const existing = await db
    .select()
    .from(projectDependencies)
    .where(and(eq(projectDependencies.projectId, projectId), eq(projectDependencies.targetProjectId, targetProject.id)))
    .get();

  if (existing) {
    throw new Error("Dependency already exists");
  }

  await db.insert(projectDependencies).values({
    projectId,
    targetProjectId: targetProject.id,
    dependencyType,
  }).run();

  revalidatePath(`/projects/${project.slug}/dependencies`);
  revalidatePath(`/projects/${project.slug}/edit`);
  return { success: true };
}

export async function addExternalProjectDependency(projectId: string, externalName: string, externalUrl: string, dependencyType: DependencyType) {
  const { db, session } = await getAuthenticatedDb();

  const project = await findProjectPostById(db, projectId);
  if (!project) throw new Error("Project not found");

  const member = await db.select().from(projectMembers).where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, session.user.id))).get();
  if (project.authorId !== session.user.id && !member && session.user.role !== "admin") {
    throw new Error("Forbidden");
  }

  await db.insert(projectDependencies).values({
    projectId,
    externalName,
    externalUrl,
    dependencyType,
  }).run();

  revalidatePath(`/projects/${project.slug}/dependencies`);
  revalidatePath(`/projects/${project.slug}/edit`);
  return { success: true };
}



/**
 * プロジェクトの依存関係を削除する
 */
export async function removeProjectDependency(dependencyId: string) {
  const { db, session } = await getAuthenticatedDb();

  const dep = await db.select().from(projectDependencies).where(eq(projectDependencies.id, dependencyId)).get();
  if (!dep) throw new Error("Dependency not found");

  const project = await findProjectPostById(db, dep.projectId);
  if (!project) throw new Error("Project not found");

  const member = await db.select().from(projectMembers).where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, session.user.id))).get();
  if (project.authorId !== session.user.id && !member && session.user.role !== "admin") {
    throw new Error("Forbidden");
  }

  await db.delete(projectDependencies).where(eq(projectDependencies.id, dependencyId)).run();
  await recordDeletion(db, "project_dependencies", dependencyId);

  revalidatePath(`/projects/${project.slug}/dependencies`);
  revalidatePath(`/projects/${project.slug}/edit/dependencies`);
  return { success: true };
}
