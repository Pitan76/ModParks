import { eq, and } from "drizzle-orm";
import type { Database } from "@modparks/core/db/client";
import { projectMembers, userProfiles } from "@modparks/core/db/schema";
import { findProjectPostById } from "@modparks/core/queries/post";
import { recordDeletion, buildRecordKey } from "@modparks/core/backup/tombstone";
import type { ServerErrorTranslator } from "@modparks/core/i18n/serverErrors";

/**
 * プロジェクトのメンバー追加・削除の本体。Next の Server Action と modparks-api の両方から呼ぶ。
 * 権限なしは移設前と同じく例外で伝える。
 */

/** メンバーを追加する。追加できるのはオーナーだけ */
export async function addProjectMember(db: Database, t: ServerErrorTranslator, userId: string, projectId: string, username: string) {
  const project = await findProjectPostById(db, projectId);
  if (!project || project.authorId !== userId) throw new Error("Forbidden: Only the owner can add members");

  const targetProfile = await db.select({ userId: userProfiles.userId }).from(userProfiles).where(eq(userProfiles.username, username)).get();
  if (!targetProfile) return { error: t("member.userNotFound") };
  if (targetProfile.userId === project.authorId) return { error: t("member.alreadyOwner") };

  const existing = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, targetProfile.userId)))
    .get();
  if (existing) return { error: t("member.alreadyMember") };

  await db.insert(projectMembers).values({ projectId, userId: targetProfile.userId, role: "collaborator" });

  return { success: true as const };
}

/** メンバーを外す。オーナーは誰でも、メンバーは自分自身だけ外せる */
export async function removeProjectMember(db: Database, userId: string, projectId: string, targetUserId: string) {
  const project = await findProjectPostById(db, projectId);
  if (!project) throw new Error("Project not found");
  if (project.authorId !== userId && targetUserId !== userId) throw new Error("Forbidden");

  await db.delete(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, targetUserId)));
  await recordDeletion(db, "project_members", buildRecordKey(projectId, targetUserId));

  return { success: true as const };
}
