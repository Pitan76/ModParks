"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { getDatabase } from "@/lib/db";
import { projectMembers, users, userProfiles } from "@modparks/core/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as members from "@modparks/core/projects/members";
import { getServerErrors } from "@/lib/i18n/serverErrors";
import { findProjectPostById } from "@modparks/core/queries/post";

/**
 * プロジェクトのメンバー一覧を取得する
 */
export async function getProjectMembers(projectId: string) {
  const db = await getDatabase();
  
  // オーナー取得
  const project = await findProjectPostById(db, projectId);
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

/** プロジェクトにメンバーを追加する Server Action。本体は core/projects/members.ts */
export async function addProjectMember(projectId: string, username: string) {
  const { db, session } = await getAuthenticatedDb();
  const result = await members.addProjectMember(db, await getServerErrors(), session.user.id, projectId, username);
  if ("success" in result) revalidatePath(`/[locale]/projects/[slug]/edit`, "page");

  return result;
}

/** プロジェクトからメンバーを削除する Server Action。本体は core/projects/members.ts */
export async function removeProjectMember(projectId: string, userId: string) {
  const { db, session } = await getAuthenticatedDb();
  const result = await members.removeProjectMember(db, session.user.id, projectId, userId);

  revalidatePath(`/[locale]/projects/[slug]/edit`, "page");
  return result;
}
