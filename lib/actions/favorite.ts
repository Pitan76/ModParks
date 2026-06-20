"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { getDatabase } from "@/lib/db";
import { projectFavorites, projects, users, userProfiles, projectTags } from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

// ─── お気に入りのトグル ─────────────────────────────────────────────────────────

export async function toggleProjectFavorite(projectId: string) {
  const { db, userId } = await getAuthenticatedDb();

  try {
    const existing = await db
      .select()
      .from(projectFavorites)
      .where(and(eq(projectFavorites.projectId, projectId), eq(projectFavorites.userId, userId)))
      .get();

    if (existing) {
      await db
        .delete(projectFavorites)
        .where(and(eq(projectFavorites.projectId, projectId), eq(projectFavorites.userId, userId)));
    } else {
      await db.insert(projectFavorites).values({ projectId, userId });
    }

    revalidatePath("/[locale]/projects", "page");
    revalidatePath("/[locale]/profile/[username]", "page");

    const project = await db.select({ slug: projects.slug }).from(projects).where(eq(projects.id, projectId)).get();
    if (project) {
      revalidatePath("/[locale]/projects/[slug]", "page");
    }

    return { success: true, favorited: !existing };
  } catch (error) {
    console.error("Failed to toggle project favorite:", error);
    return { success: false, error: "お気に入りの操作に失敗しました" };
  }
}

// ─── お気に入り一覧取得 ─────────────────────────────────────────────────────────

export async function getFavoriteProjects(userId: string) {
  const db = await getDatabase();
  
  // project_favorites と projects, users を結合して取得
  const rows = await db
    .select({
      project: projects,
      author: {
        username: userProfiles.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
      },
      favoritedAt: projectFavorites.createdAt
    })
    .from(projectFavorites)
    .innerJoin(projects, eq(projectFavorites.projectId, projects.id))
    .leftJoin(users, eq(projects.authorId, users.id))
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(eq(projectFavorites.userId, userId))
    .orderBy(desc(projectFavorites.createdAt))
    .all();

  const projectIds = rows.map((r) => r.project.id);
  let tagsData: { projectId: string; tag: string }[] = [];
  if (projectIds.length > 0) {
    tagsData = await db
      .select()
      .from(projectTags)
      .where(inArray(projectTags.projectId, projectIds))
      .all();
  }

  return rows.map((row) => ({
    ...row.project,
    authorUsername: row.author?.username,
    authorDisplayName: row.author?.displayName ?? row.author?.username,
    authorAvatarUrl: row.author?.avatarUrl,
    tags: tagsData.filter((t) => t.projectId === row.project.id).map((t) => t.tag),
    favoritedAt: row.favoritedAt
  }));
}

// ─── クッキーによるお気に入り (非ログイン時) ──────────────────────────────────────

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
    favorites.push(projectId);
    favorited = true;
  }

  cookieStore.set("favorites", JSON.stringify(favorites), { path: "/", maxAge: 60 * 60 * 24 * 365 }); // 1 year
  
  revalidatePath("/[locale]/projects", "page");
  revalidatePath("/[locale]/projects/[slug]", "page");

  return { success: true, favorited };
}
