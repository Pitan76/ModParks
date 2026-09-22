import { posts, ideas, comments, userSettings } from "@modparks/core/db/schema";
import { notifyToUser, resolveActor, type UserNotifyContext } from "@modparks/core/notifications/dispatch";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";

/**
 * 自動コメントの文言。コメントは DB に文字列で残るため、書き込む時点で言語を決める必要がある。
 * core は翻訳の手段を持たないので受け取る（NotificationMessage と同じ）。
 */
export type SystemCommentMessage = (
  locale: "ja" | "en",
  key: "ideaResolved",
  values: Record<string, string>,
) => Promise<string>;

export type IdeaLinkContext = UserNotifyContext & { systemComment: SystemCommentMessage };

/**
 * アイデアが解決された際に自動でシステムコメントを追加し、起票者へ通知を送る。
 * 文言は起票者の言語で書く。解決を知らせる相手が起票者であるため。
 */
export async function createSystemCommentForResolvedIdea(
  ctx: IdeaLinkContext,
  ideaId: string,
  versionId: string,
  versionNumber: string,
  projectSlug: string,
  userId: string
) {
  const { db } = ctx;
  const idea = await db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      authorId: posts.authorId,
      locale: userSettings.locale,
    })
    .from(ideas)
    .innerJoin(posts, eq(posts.id, ideas.id))
    .leftJoin(userSettings, eq(userSettings.userId, posts.authorId))
    .where(eq(ideas.id, ideaId))
    .get();
  if (!idea) return;

  const locale = idea.locale === "en" ? "en" : "ja";
  const content = await ctx.systemComment(locale, "ideaResolved", { versionNumber, projectSlug });

  await db.insert(comments).values({
    id: createId(),
    postId: ideaId,
    content,
    contentFormat: "markdown",
    authorId: userId,
  }).run();

  const actor = await resolveActor(db, userId);
  await notifyToUser(ctx, idea.authorId, userId, "comment", {
    kind: "idea",
    slug: idea.slug,
    title: idea.title,
    ...actor,
  });
}
