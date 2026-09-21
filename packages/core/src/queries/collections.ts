import { and, desc, eq, inArray } from "drizzle-orm";
import type { Database } from "@modparks/core/db/client";
import { collectionItems, collections } from "@modparks/core/db/schema";

/**
 * ユーザーのコレクション一覧。本人なら非公開も含める。
 *
 * 以前は "use server" のファイルから export されていたため、外部から任意の
 * viewerId を渡して呼べた。viewerId に相手の ID を渡すだけで本人扱いになり、
 * 非公開コレクションを読めてしまっていた。ここでは受け取った viewerId を信用するので、
 * 呼び出し側は必ずセッションなどサーバが確かめた ID を渡すこと。
 * @param db データベース接続
 * @param targetUserId 一覧を見たいユーザー
 * @param viewerId 閲覧者。未ログインなら undefined
 */
export async function listUserCollections(db: Database, targetUserId: string, viewerId?: string) {
  const isOwner = targetUserId === viewerId;
  const rows = await db.select().from(collections).where(eq(collections.userId, targetUserId)).orderBy(desc(collections.createdAt)).all();

  return rows.filter((row) => isOwner || row.visibility === "public");
}

/**
 * 本人のコレクション一覧と、それぞれに指定のプロジェクトが入っているか。
 *
 * 本人専用（非公開も返す）。以前は userId を引数で受け取る Server Action で、
 * 誰の ID でも渡せた。呼び出し側はセッションの ID だけを渡すこと。
 * @param db データベース接続
 * @param userId セッションで確かめた本人のユーザーID
 * @param projectId 含まれているかを調べるプロジェクト
 */
export async function listCollectionsWithProjectStatus(db: Database, userId: string, projectId: string) {
  const userCollections = await db.select().from(collections).where(eq(collections.userId, userId)).orderBy(desc(collections.createdAt)).all();
  if (userCollections.length === 0) return [];

  const items = await db
    .select({ collectionId: collectionItems.collectionId })
    .from(collectionItems)
    .where(and(inArray(collectionItems.collectionId, userCollections.map((c) => c.id)), eq(collectionItems.projectId, projectId)))
    .all();
  const itemSet = new Set(items.map((i) => i.collectionId));

  return userCollections.map((c) => ({ ...c, containsProject: itemSet.has(c.id) }));
}
