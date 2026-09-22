import { posts, ideas, comments } from "@modparks/core/db/schema";
import { notifyToUser, resolveActor, type UserNotifyContext } from "@modparks/core/notifications/dispatch";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";

/**
 * アイデアが解決された際に自動でシステムコメントを追加し、起票者へ通知を送るヘルパー関数。
 */
export async function createSystemCommentForResolvedIdea(
  notify: UserNotifyContext,
  ideaId: string,
  versionId: string,
  versionNumber: string,
  projectSlug: string,
  userId: string
) {
  const { db } = notify;
  const commentId = createId();
  const content = `このアイデアはバージョン [${versionNumber}](/projects/${projectSlug}) で解決されました。`;

  await db.insert(comments).values({
    id: commentId,
    postId: ideaId,
    content,
    contentFormat: "markdown",
    authorId: userId,
  }).run();

  const idea = await db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      authorId: posts.authorId,
    })
    .from(ideas)
    .innerJoin(posts, eq(posts.id, ideas.id))
    .where(eq(ideas.id, ideaId))
    .get();

  if (idea) {
    const actor = await resolveActor(db, userId);
    await notifyToUser(notify, idea.authorId, userId, "comment", {
      kind: "idea",
      slug: idea.slug,
      title: idea.title,
      ...actor,
    });
  }
}
