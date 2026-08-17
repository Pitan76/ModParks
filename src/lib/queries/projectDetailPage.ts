import { cookies } from "next/headers";
import { favorites, projectSubscriptions, projectMembers, userSettings } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getProjectDependencies, getProjectDependents } from "@/lib/queries/dependency";
import { getPublicProjectMedia } from "@/lib/queries/projectMedia";
import { getProjectBySlug } from "@/lib/actions/projectQuery";
import type { Database } from "@/lib/db";
import type { Session } from "next-auth";

type ProjectDetail = NonNullable<Awaited<ReturnType<typeof getProjectBySlug>>>;

/**
 * プロジェクト詳細ページの本文が必要とする周辺データ（お気に入り・依存関係・
 * メディア・購読状況・コメント設定）をまとめて取得する。
 *
 * 個別クエリのままページ側に置くと、どれが表示に要るデータなのかが
 * JSXの合間に埋もれてしまうため、ここに集約している。
 */
export async function loadProjectDetailPageData(db: Database, project: ProjectDetail, session: Session | null) {
  const userId = session?.user?.id;

  const [favoritesData, userFavoriteData, dependencies, dependents, userSubscription, media, membership, settingsRecord] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(favorites).where(eq(favorites.postId, project.id)).get(),
    userId ? db.select().from(favorites).where(and(eq(favorites.postId, project.id), eq(favorites.userId, userId))).get() : null,
    // バージョン限定の依存もタブに出す（どのバージョン向けかはカード側で示す）
    getProjectDependencies(project.id, true),
    getProjectDependents(project.id),
    userId ? db.select().from(projectSubscriptions).where(and(eq(projectSubscriptions.projectId, project.id), eq(projectSubscriptions.userId, userId))).get() : null,
    getPublicProjectMedia(project.id),
    userId ? db.select({ userId: projectMembers.userId }).from(projectMembers).where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, userId))).get() : null,
    userId ? db.select({ defaultCommentBodyFormat: userSettings.defaultCommentBodyFormat }).from(userSettings).where(eq(userSettings.userId, userId)).get() : null,
  ]);

  const cookieStore = await cookies();
  const favCookie = cookieStore.get("favorites")?.value;
  let cookieFavorites: string[] = [];
  if (favCookie) {
    try { cookieFavorites = JSON.parse(favCookie); } catch {}
  }

  const isFavorited = userId ? !!userFavoriteData : cookieFavorites.includes(project.id);

  return {
    favoritesCount: favoritesData?.count || 0,
    isFavorited,
    dependencies,
    dependents,
    isSubscribed: !!userSubscription,
    media,
    featuredMedia: media.filter((m) => m.featured),
    membership,
    settingsRecord,
  };
}
