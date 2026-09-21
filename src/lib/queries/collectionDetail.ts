import { getDatabase } from "@/lib/db";
import { collections, collectionItems, posts, projects, users, userProfiles, projectTags } from "@modparks/core/db/schema";
import { eq, desc, inArray, getTableColumns } from "drizzle-orm";
import { toProjectPost } from "@modparks/core/queries/postRow";
import { translatedBodyPreview, translatedTitle } from "@/lib/queries/translatedColumns";

/**
 * コレクションの詳細。非公開なら所有者にだけ返す。
 *
 * 以前は "use server" のファイルから export されていたため、外部から任意の
 * viewerId を渡して呼べた。所有者の ID を渡すだけで他人の非公開リストを
 * 読めてしまっていた。通常のモジュールへ移し、サーバ内部からしか呼べないようにした。
 * 呼び出し側は viewerId にセッションで確かめた ID だけを渡すこと。
 */
export async function getCollectionById(id: string, viewerId?: string, locale?: string) {
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
    posts: { ...getTableColumns(posts), title: translatedTitle(locale), body: translatedBodyPreview(locale) },
    projects: projects,
    author: {
      username: userProfiles.username,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
    },
    addedAt: collectionItems.addedAt,
  })
    .from(collectionItems)
    .innerJoin(projects, eq(collectionItems.projectId, projects.id))
    .innerJoin(posts, eq(posts.id, projects.id))
    .leftJoin(users, eq(posts.authorId, users.id))
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(eq(collectionItems.collectionId, id))
    .orderBy(desc(collectionItems.addedAt))
    .all();

  // ---- Gather tags for each project -------------------------------------
  // Collect all project IDs from the items we just fetched.
  const projectIds = items.map(i => i.posts.id);
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
    // posts と projects を平坦化してから返す。ネストした形は外へ出さない
    items: items.map(item => ({
      ...toProjectPost(item),
      tags: tagsMap[item.posts.id] ?? [],
      authorUsername: item.author?.username,
      authorDisplayName: item.author?.displayName ?? item.author?.username,
      authorAvatarUrl: item.author?.avatarUrl,
      addedAt: item.addedAt,
    })),
  };
}
