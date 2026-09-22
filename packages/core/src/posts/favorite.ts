import { and, eq } from "drizzle-orm";
import { favorites, posts } from "@modparks/core/db/schema";
import type { ServerErrorTranslator } from "@modparks/core/i18n/serverErrors";
import { notifyToUser, resolveActor, type UserNotifyContext } from "@modparks/core/notifications/dispatch";

/**
 * 投稿（プロジェクト・アイデア共通）のお気に入りを切り替える本体。
 *
 * 戻り値は移設前の Server Action と同じ形に kind を足したもの。kind は Next 側が
 * どのページを無効化するかを知るため（画面側は使わない）。
 */
export type FavoriteDeps = { notify: UserNotifyContext; t: ServerErrorTranslator };

export async function togglePostFavorite({ notify, t }: FavoriteDeps, userId: string, postId: string) {
  const { db } = notify;

  // DB は外部I/O境界。失敗は表示用の文言にして返す（移設前と同じ）
  try {
    const where = and(eq(favorites.postId, postId), eq(favorites.userId, userId));
    const existing = await db.select().from(favorites).where(where).get();
    if (existing) await db.delete(favorites).where(where);
    else await db.insert(favorites).values({ postId, userId });

    const post = await db
      .select({ kind: posts.kind, slug: posts.slug, title: posts.title, authorId: posts.authorId })
      .from(posts)
      .where(eq(posts.id, postId))
      .get();
    // 付けたときだけ作者へ知らせる（外したことは知らせない）
    if (post && !existing) {
      const payload = { kind: post.kind, slug: post.slug, title: post.title, ...(await resolveActor(db, userId)) };
      await notifyToUser(notify, post.authorId, userId, "favorite", payload);
    }

    return { success: true as const, favorited: !existing, kind: post?.kind };
  } catch (error) {
    console.error("Failed to toggle favorite:", error);
    return { success: false as const, error: t("favorite.toggleFailed") };
  }
}
