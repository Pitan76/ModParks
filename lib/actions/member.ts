"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { getDatabase } from "@/lib/db";
import { projects, projectMembers, users, userProfiles } from "@/db/schema";
import { eq, and, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * プロジェクトのメンバー一覧を取得する
 */
export async function getProjectMembers(projectId: string) {
  const db = await getDatabase();
  
  // オーナー取得
  const project = await db.select({ authorId: projects.authorId }).from(projects).where(eq(projects.id, projectId)).get();
  if (!project) return [];

  const owner = await db.select({
    id: users.id,
    username: userProfiles.username,
    displayName: userProfiles.displayName,
    avatarUrl: userProfiles.avatarUrl,
  }).from(users)
  .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
  .where(eq(users.id, project.authorId)).get();

  // メンバー取得
  const members = await db.select({
    id: users.id,
    username: userProfiles.username,
    displayName: userProfiles.displayName,
    avatarUrl: userProfiles.avatarUrl,
    role: projectMembers.role,
  })
  .from(projectMembers)
  .innerJoin(users, eq(projectMembers.userId, users.id))
  .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
  .where(eq(projectMembers.projectId, projectId))
  .all();

  const result = [];
  if (owner) {
    result.push({ ...owner, role: "owner" as const });
  }
  
  for (const m of members) {
    result.push({ ...m, role: "collaborator" as const });
  }

  return result;
}

/**
 * プロジェクトにメンバーを追加する
 */
export async function addProjectMember(projectId: string, username: string) {
  const { db, session } = await getAuthenticatedDb();

  // 権限チェック（オーナーのみ追加可能）
  const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project || project.authorId !== session.user.id) {
    throw new Error("Forbidden: Only the owner can add members");
  }

  // 追加対象ユーザーを探す
  const targetProfile = await db.select().from(userProfiles).where(eq(userProfiles.username, username)).get();
  if (!targetProfile) {
    return { error: "ユーザーが見つかりません" };
  }
  const targetUser = { id: targetProfile.userId };

  if (targetUser.id === project.authorId) {
    return { error: "既にオーナーです" };
  }

  // 既存メンバーかチェック
  const existing = await db.select().from(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, targetUser.id))).get();
  if (existing) {
    return { error: "既に追加されています" };
  }

  // 追加
  await db.insert(projectMembers).values({
    projectId,
    userId: targetUser.id,
    role: "collaborator",
  });

  revalidatePath(`/[locale]/projects/[slug]/edit`, "page");
  return { success: true };
}

/**
 * プロジェクトからメンバーを削除する
 */
export async function removeProjectMember(projectId: string, userId: string) {
  const { db, session } = await getAuthenticatedDb();

  // 権限チェック（オーナー、もしくは自分自身なら削除可能）
  const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project) {
    throw new Error("Project not found");
  }

  if (project.authorId !== session.user.id && userId !== session.user.id) {
    throw new Error("Forbidden");
  }

  await db.delete(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));

  revalidatePath(`/[locale]/projects/[slug]/edit`, "page");
  return { success: true };
}
