"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { getDatabase } from "@/lib/db";
import { projectDependencies, projects, projectMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recordDeletion } from "@/lib/backup/tombstone";

export type DependencyType = "required" | "optional" | "incompatible" | "embedded";

/**
 * プロジェクトの依存関係を取得する
 */
export async function getProjectDependencies(projectId: string) {
  const db = await getDatabase();

  const deps = await db
    .select({
      id: projectDependencies.id,
      dependencyType: projectDependencies.dependencyType,
      targetProject: projects,
      externalUrl: projectDependencies.externalUrl,
      externalName: projectDependencies.externalName,
    })
    .from(projectDependencies)
    .leftJoin(projects, eq(projectDependencies.targetProjectId, projects.id))
    .where(eq(projectDependencies.projectId, projectId))
    .all();

  return deps.map((d) => ({
    id: d.id,
    dependencyType: d.dependencyType as DependencyType,
    project: d.targetProject ? d.targetProject : { id: d.id, slug: d.id, name: d.externalName || "Unknown External", iconUrl: null },
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
      sourceProject: projects,
    })
    .from(projectDependencies)
    .innerJoin(projects, eq(projectDependencies.projectId, projects.id))
    .where(eq(projectDependencies.targetProjectId, projectId))
    .all();

  return deps.map((d) => ({
    id: d.id,
    dependencyType: d.dependencyType as DependencyType,
    project: d.sourceProject,
  }));
}

/**
 * プロジェクトに依存関係を追加する（Slugで指定）
 */
export async function addProjectDependencyBySlug(projectId: string, targetSlug: string, dependencyType: DependencyType) {
  const { db, session } = await getAuthenticatedDb();

  const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project) throw new Error("Project not found");

  const targetProject = await db.select().from(projects).where(eq(projects.slug, targetSlug)).get();
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

  const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();
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

  const project = await db.select().from(projects).where(eq(projects.id, dep.projectId)).get();
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
