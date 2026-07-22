"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { getDatabase } from "@/lib/db";
import { projectFavorites, projects, users, userProfiles } from "@/db/schema";
import { eq, and, desc, sql, getTableColumns } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { notifyToUser, resolveActorName } from "@/lib/notifications/notify";
import { getServerErrors } from "@/lib/i18n/serverErrors";

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

    const project = await db
      .select({ slug: projects.slug, name: projects.name, authorId: projects.authorId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();
    if (project) {
      revalidatePath("/[locale]/projects/[slug]", "page");
      if (!existing) {
        await notifyToUser(db, project.authorId, userId, "project_favorite", {
          projectSlug: project.slug,
          projectName: project.name,
          actorName: await resolveActorName(db, userId),
        });
      }
    }

    return { success: true, favorited: !existing };
  } catch (error) {
    console.error("Failed to toggle project favorite:", error);
    return { success: false, error: (await getServerErrors())("favorite.toggleFailed") };
  }
}

// ─── お気に入り一覧取得 ─────────────────────────────────────────────────────────

export async function getFavoriteProjects(userId: string) {
  const db = await getDatabase();
  const { description, ...restProjects } = getTableColumns(projects);
  
  // project_favorites と projects, users を結合して取得
  const rows = await db
    .select({
      project: {
        ...restProjects,
        description: sql<string>`SUBSTR(${projects.description}, 1, 1200) || CASE WHEN LENGTH(${projects.description}) > 1200 THEN '...' ELSE '' END`,
        tagsJson: sql<string>`(SELECT json_group_array(tag) FROM project_tags WHERE project_id = projects.id)`
      },
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

  return rows.map((row) => {
    let parsedTags: string[] = [];
    if (row.project.tagsJson) {
      try {
        const t = JSON.parse(row.project.tagsJson);
        if (Array.isArray(t) && t.length > 0 && t[0] !== null) {
          parsedTags = t;
        }
      } catch(e) {}
    }
    
    const { tagsJson, ...projectData } = row.project;

    return {
      ...projectData,
      authorUsername: row.author?.username,
      authorDisplayName: row.author?.displayName ?? row.author?.username,
      authorAvatarUrl: row.author?.avatarUrl,
      tags: parsedTags,
      favoritedAt: row.favoritedAt
    };
  });
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
