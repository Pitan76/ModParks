"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { getDatabase } from "@/lib/db";
import { projectFavorites, projects, users, userProfiles, projectTags } from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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
