"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { collections, collectionItems, posts } from "@modparks/core/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recordDeletion, buildRecordKey } from "@modparks/core/backup/tombstone";
import { chunkRows } from "@modparks/core/db/chunkRows";

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
  await recordDeletion(db, "collections", id);

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
    await recordDeletion(db, "collection_items", buildRecordKey(collectionId, projectId));
  } else {
    await db.insert(collectionItems).values({ collectionId, projectId });
    added = true;

    const project = await db
      .select({ slug: posts.slug, title: posts.title, authorId: posts.authorId })
      .from(posts)
      .where(eq(posts.id, projectId))
      .get();
    if (project) {
      const { notifyToUser, resolveActor } = await import("@/lib/notifications/notify");
      await notifyToUser(db, project.authorId, userId, "list_add", {
        kind: "project",
        slug: project.slug,
        title: project.title,
        collectionName: collection.name,
        ...(await resolveActor(db, userId)),
      });
    }
  }

  revalidatePath("/[locale]/lists/[id]", "page");
  return { success: true, added };
}

/**
 * 複数プロジェクトをまとめてコレクションへ追加する（カートからの一括保存用）。
 * トグルと違い、既に入っているものは「そのまま残す」だけで削除しない。
 * @returns 実際に追加された件数
 */
export async function addProjectsToCollection(collectionId: string, projectIds: string[]) {
  const { db, userId } = await getAuthenticatedDb();

  const collection = await db.select().from(collections).where(and(eq(collections.id, collectionId), eq(collections.userId, userId))).get();
  if (!collection) {
    throw new Error("Forbidden or Not Found");
  }

  const uniqueIds = [...new Set(projectIds)];
  if (uniqueIds.length === 0) return { success: true, added: 0 };

  // 既に入っているものを一度に引いて、差分だけを挿入する
  const existing = await db.select({ projectId: collectionItems.projectId })
    .from(collectionItems)
    .where(and(eq(collectionItems.collectionId, collectionId), inArray(collectionItems.projectId, uniqueIds)))
    .all();
  const existingSet = new Set(existing.map(e => e.projectId));

  const fresh = uniqueIds.filter(id => !existingSet.has(id));
  if (fresh.length === 0) return { success: true, added: 0 };

  for (const chunk of chunkRows(fresh, 2)) {
    await db.insert(collectionItems).values(chunk.map(projectId => ({ collectionId, projectId })));
  }

  // 追加されたプロジェクトの作者へ通知する（トグル時と同じ扱い）
  const addedProjects = await db
    .select({ slug: posts.slug, title: posts.title, authorId: posts.authorId })
    .from(posts)
    .where(inArray(posts.id, fresh))
    .all();
  if (addedProjects.length > 0) {
    const { notifyToUser, resolveActor } = await import("@/lib/notifications/notify");
    const actor = await resolveActor(db, userId);
    for (const project of addedProjects) {
      await notifyToUser(db, project.authorId, userId, "list_add", {
        kind: "project",
        slug: project.slug,
        title: project.title,
        collectionName: collection.name,
        ...actor,
      });
    }
  }

  revalidatePath("/[locale]/lists/[id]", "page");
  return { success: true, added: fresh.length };
}
