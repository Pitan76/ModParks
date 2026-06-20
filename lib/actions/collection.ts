"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { getDatabase } from "@/lib/db";
import { collections, collectionItems, projects, users, userProfiles, projectTags } from "@/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { eq, and, desc, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createCollection(name: string, description: string | null, visibility: "public" | "unlisted" | "private") {
  const { db, userId } = await getAuthenticatedDb();
  const id = createId();

  await db.insert(collections).values({
    id,
    userId,
    name,
    description,
    visibility,
  });

  revalidatePath("/[locale]/profile/[username]", "page");
  return { success: true, id };
}

export async function updateCollection(id: string, name: string, description: string | null, visibility: "public" | "unlisted" | "private") {
  const { db, userId } = await getAuthenticatedDb();

  const existing = await db.select().from(collections).where(and(eq(collections.id, id), eq(collections.userId, userId))).get();
  if (!existing) {
    throw new Error("Forbidden or Not Found");
  }

  await db.update(collections).set({
    name,
    description,
    visibility,
    updatedAt: new Date(),
  }).where(eq(collections.id, id));

  revalidatePath("/[locale]/profile/[username]", "page");
  revalidatePath("/[locale]/lists/[id]", "page");
  return { success: true };
}

export async function deleteCollection(id: string) {
  const { db, userId } = await getAuthenticatedDb();

  const existing = await db.select().from(collections).where(and(eq(collections.id, id), eq(collections.userId, userId))).get();
  if (!existing) {
    throw new Error("Forbidden or Not Found");
  }

  await db.delete(collections).where(eq(collections.id, id));

  revalidatePath("/[locale]/profile/[username]", "page");
  return { success: true };
}

export async function toggleProjectInCollection(collectionId: string, projectId: string) {
  const { db, userId } = await getAuthenticatedDb();

  // Verify ownership
  const collection = await db.select().from(collections).where(and(eq(collections.id, collectionId), eq(collections.userId, userId))).get();
  if (!collection) {
    throw new Error("Forbidden or Not Found");
  }

  const existing = await db.select().from(collectionItems)
    .where(and(eq(collectionItems.collectionId, collectionId), eq(collectionItems.projectId, projectId)))
    .get();

  let added = false;
  if (existing) {
    await db.delete(collectionItems)
      .where(and(eq(collectionItems.collectionId, collectionId), eq(collectionItems.projectId, projectId)));
  } else {
    await db.insert(collectionItems).values({ collectionId, projectId });
    added = true;
  }

  revalidatePath("/[locale]/lists/[id]", "page");
  return { success: true, added };
}

export async function getUserCollections(targetUserId: string, viewerId?: string) {
  const db = await getDatabase();
  const isOwner = targetUserId === viewerId;

  let query = db.select().from(collections).where(eq(collections.userId, targetUserId));
  const rows = await query.orderBy(desc(collections.createdAt)).all();

  // Filter based on visibility
  return rows.filter(row => {
    if (isOwner) return true;
    return row.visibility === "public";
  });
}

export async function getUserCollectionsWithProjectStatus(userId: string, projectId: string) {
  const db = await getDatabase();
  const userCollections = await db.select().from(collections).where(eq(collections.userId, userId)).orderBy(desc(collections.createdAt)).all();
  
  if (userCollections.length === 0) return [];

  const collectionIds = userCollections.map(c => c.id);
  const items = await db.select().from(collectionItems).where(
    and(
      inArray(collectionItems.collectionId, collectionIds),
      eq(collectionItems.projectId, projectId)
    )
  ).all();

  const itemSet = new Set(items.map(i => i.collectionId));

  return userCollections.map(c => ({
    ...c,
    containsProject: itemSet.has(c.id)
  }));
}

export async function getCollectionById(id: string, viewerId?: string) {
  const db = await getDatabase();

  const collectionRow = await db.select({
    collection: collections,
    author: {
      username: userProfiles.username,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
    }
  }).from(collections)
    .leftJoin(users, eq(collections.userId, users.id))
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(eq(collections.id, id))
    .get();

  if (!collectionRow || (collectionRow.collection.visibility === "private" && collectionRow.collection.userId !== viewerId)) return null;

  // Fetch the basic project info for items in this collection
  const items = await db.select({
    project: projects,
    author: {
      username: userProfiles.username,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
    },
    addedAt: collectionItems.addedAt,
  })
    .from(collectionItems)
    .innerJoin(projects, eq(collectionItems.projectId, projects.id))
    .leftJoin(users, eq(projects.authorId, users.id))
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(eq(collectionItems.collectionId, id))
    .orderBy(desc(collectionItems.addedAt))
    .all();

  // ---- Gather tags for each project -------------------------------------
  // Collect all project IDs from the items we just fetched.
  const projectIds = items.map(i => i.project.id);
  // Pull tags (projectId, tag) for those projects.
  const tagRows = await db
    .select({ projectId: projectTags.projectId, tag: projectTags.tag })
    .from(projectTags)
    .where(inArray(projectTags.projectId, projectIds))
    .all();
  // Build a map of projectId → string[]
  const tagsMap: Record<string, string[]> = {};
  tagRows.forEach(row => {
    if (!tagsMap[row.projectId]) tagsMap[row.projectId] = [];
    tagsMap[row.projectId].push(row.tag);
  });

  return {
    ...collectionRow.collection,
    author: collectionRow.author,
    // Map each item, attaching the gathered tags (or an empty array)
    items: items.map(item => ({
      ...item.project,
      tags: tagsMap[item.project.id] ?? [],
      authorUsername: item.author?.username,
      authorDisplayName: item.author?.displayName ?? item.author?.username,
      authorAvatarUrl: item.author?.avatarUrl,
      addedAt: item.addedAt,
    })),
  };
}
