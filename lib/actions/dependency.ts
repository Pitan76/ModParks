"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { getDatabase } from "@/lib/db";
import { projectDependencies, projects, projectMembers, users } from "@/db/schema";
import { eq, and, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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
    })
    .from(projectDependencies)
    .innerJoin(projects, eq(projectDependencies.targetProjectId, projects.id))
    .where(eq(projectDependencies.projectId, projectId))
    .all();

  return deps.map((d) => ({
    id: d.id,
    dependencyType: d.dependencyType as DependencyType,
    project: d.targetProject,
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
 * プロジェクトに依存関係を追加する
 */
export async function addProjectDependency(projectId: string, targetProjectId: string, dependencyType: DependencyType) {
  const { db, session } = await getAuthenticatedDb();

  if (projectId === targetProjectId) {
    throw new Error("Cannot depend on itself");
  }

  const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project) throw new Error("Project not found");

  const member = await db.select().from(projectMembers).where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, session.user.id))).get();
  if (project.authorId !== session.user.id && !member && session.user.role !== "admin") {
    throw new Error("Forbidden");
  }

  const existing = await db
    .select()
    .from(projectDependencies)
    .where(and(eq(projectDependencies.projectId, projectId), eq(projectDependencies.targetProjectId, targetProjectId)))
    .get();

  if (existing) {
    throw new Error("Dependency already exists");
  }

  await db.insert(projectDependencies).values({
    projectId,
    targetProjectId,
    dependencyType,
  }).run();

  revalidatePath(`/projects/${project.slug}/dependencies`);
  revalidatePath(`/projects/${project.slug}/edit/dependencies`);
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

  revalidatePath(`/projects/${project.slug}/dependencies`);
  revalidatePath(`/projects/${project.slug}/edit/dependencies`);
  return { success: true };
}
