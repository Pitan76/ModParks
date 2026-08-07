"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { posts } from "@/db/schema";
import { eq, and, inArray, type SQL } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recordDeletion } from "@/lib/backup/tombstone";
import { isAdminSession } from "@/lib/auth/roles";
import type { Session } from "next-auth";

/**
 * 一括操作の対象を絞る条件。
 *
 * 管理者は指定された全件、それ以外は自分が作者のものだけ。
 * 更新系と削除系で条件がずれると片方だけ他人の投稿に届いてしまうため、1 箇所で作る。
 */
function scopeCondition(session: Session, projectIds: string[]): SQL | undefined {
  if (isAdminSession(session)) return inArray(posts.id, projectIds);
  return and(inArray(posts.id, projectIds), eq(posts.authorId, session.user.id));
}

/**
 * 複数のプロジェクトの公開ステータスを一括変更する Server Action。
 */
export const batchUpdateProjectStatus = async (
  projectIds: string[],
  status: "public" | "unlisted" | "private" | "draft",
) => {
  const { db, session } = await getAuthenticatedDb();
  if (!projectIds.length) return { success: true };

  // 公開範囲も作者も posts が持つため、projects を触る必要がない
  const conditions = scopeCondition(session, projectIds);

  // 下書きから出るものは、その時点を作成日時に付け直す（updateProject と同じ扱い）
  if (status !== "draft") {
    await db
      .update(posts)
      .set({ createdAt: new Date() })
      .where(and(conditions, eq(posts.visibility, "draft")))
      .run();
  }

  await db.update(posts).set({ visibility: status, updatedAt: new Date() }).where(conditions).run();

  revalidatePath("/projects");
  revalidatePath("/projects/manage");
  return { success: true };
};

/**
 * 複数のプロジェクトを一括削除する Server Action。
 */
export const batchDeleteProjects = async (projectIds: string[]) => {
  const { db, session } = await getAuthenticatedDb();
  if (!projectIds.length) return { success: true };

  const conditions = scopeCondition(session, projectIds);

  const deletable = await db.select({ id: posts.id }).from(posts).where(conditions).all();

  // posts を削除すると projects は cascade で消える。逆向きに消すと posts が孤児になる
  await db.delete(posts).where(conditions).run();

  await recordDeletion(db, "posts", deletable.map((p: { id: string }) => p.id));

  revalidatePath("/projects");
  revalidatePath("/projects/manage");
  return { success: true };
};
