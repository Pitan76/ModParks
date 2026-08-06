"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { getDatabase } from "@/lib/db";
import { favorites, posts, projects, users, userProfiles } from "@/db/schema";
import { eq, and, desc, sql, getTableColumns } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { notifyToUser, resolveActor } from "@/lib/notifications/notify";
import { getServerErrors } from "@/lib/i18n/serverErrors";
import { mapProjectRow } from "@/lib/queries/projectRow";

// ---- お気に入りのトグル ----

/**
 * 投稿のお気に入りを切り替える。Project / Idea のどちらでも同じ経路を通る。
 * かつての toggleProjectFavorite（いいね/ブックマーク）を統合したもの。
 */
export async function togglePostFavorite(postId: string) {
  const { db, userId } = await getAuthenticatedDb();

  try {
    const existing = await db
      .select()
      .from(favorites)
      .where(and(eq(favorites.postId, postId), eq(favorites.userId, userId)))
      .get();

    if (existing) {
      await db
        .delete(favorites)
        .where(and(eq(favorites.postId, postId), eq(favorites.userId, userId)));
    } else {
      await db.insert(favorites).values({ postId, userId });
    }

    revalidatePath("/[locale]/projects", "page");
    revalidatePath("/[locale]/profile/[username]", "page");

    const post = await db
      .select({ kind: posts.kind, slug: posts.slug, title: posts.title, authorId: posts.authorId })
      .from(posts)
      .where(eq(posts.id, postId))
      .get();
    if (post) {
      revalidatePath(post.kind === "project" ? "/[locale]/projects/[slug]" : "/[locale]/ideas/[slug]", "page");
      if (!existing) {
        await notifyToUser(db, post.authorId, userId, "favorite", {
          kind: post.kind,
          slug: post.slug,
          title: post.title,
          ...(await resolveActor(db, userId)),
        });
      }
    }

    return { success: true, favorited: !existing };
  } catch (error) {
    console.error("Failed to toggle favorite:", error);
    return { success: false, error: (await getServerErrors())("favorite.toggleFailed") };
  }
}

// ---- お気に入り一覧取得 ----

export async function getFavoriteProjects(userId: string) {
  const db = await getDatabase();
  const { body, ...restPosts } = getTableColumns(posts);

  // favorites には Idea も含まれるため、projects との inner join で Project だけに絞る
  const rows = await db
    .select({
      project: {
        ...restPosts,
        ...getTableColumns(projects),
        body: sql<string>`SUBSTR(${posts.body}, 1, 1200) || CASE WHEN LENGTH(${posts.body}) > 1200 THEN '...' ELSE '' END`,
        tagsJson: sql<string>`(SELECT json_group_array(tag) FROM project_tags WHERE project_id = posts.id)`
      },
      author: {
        username: userProfiles.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
      },
      favoritedAt: favorites.createdAt
    })
    .from(favorites)
    .innerJoin(posts, eq(favorites.postId, posts.id))
    .innerJoin(projects, eq(projects.id, posts.id))
    .leftJoin(users, eq(posts.authorId, users.id))
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(eq(favorites.userId, userId))
    .orderBy(desc(favorites.createdAt))
    .all();

  return rows.map((row) => ({ ...mapProjectRow(row), favoritedAt: row.favoritedAt }));
}

// ---- クッキーによるお気に入り (非ログイン時) ----

export async function toggleCookieFavorite(projectId: string) {
  const cookieStore = await cookies();
  const favCookie = cookieStore.get("favorites")?.value;
  let favorites: string[] = [];
  if (favCookie) {
    try { favorites = JSON.parse(favCookie); } catch {}
  }

  let favorited = false;
  if (favorites.includes(projectId)) {
    favorites = favorites.filter(id => id !== projectId);
  } else {
    // M-4: Limit max cookie favorites to 50 to prevent DoS via huge cookie size
    if (favorites.length >= 50) {
      favorites.shift(); // Remove the oldest favorite
    }
    favorites.push(projectId);
    favorited = true;
  }

  cookieStore.set("favorites", JSON.stringify(favorites), { path: "/", maxAge: 60 * 60 * 24 * 365 }); // 1 year
  
  revalidatePath("/[locale]/projects", "page");
  revalidatePath("/[locale]/projects/[slug]", "page");

  return { success: true, favorited };
}
