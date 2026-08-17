"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { posts, ideas, ideaTags } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getServerErrors } from "@/lib/i18n/serverErrors";
import { recordDeletion } from "@/lib/backup/tombstone";
import type { ActionResult } from "@/lib/actions/actionResult";
import type { Database } from "@/lib/db";
import type { Session } from "next-auth";

/**
 * ログインユーザーが管理可能なアイデアIDのみを抽出する
 */
async function getManageableIdeas(db: Database, session: Session, ideaIds: string[]) {
  let query = db
    .select({ id: posts.id })
    .from(posts)
    .innerJoin(ideas, eq(posts.id, ideas.id))
    .where(and(eq(posts.kind, "idea"), inArray(posts.id, ideaIds)));

  // 管理者でない場合は自分が作成者であるもののみ
  const isAdmin = session.user.role === "admin";
  if (!isAdmin) {
    // @ts-ignore
    query = query.where(eq(posts.authorId, session.user.id));
  }

  return await query.all();
}

/**
 * 複数のアイデアの公開ステータスを一括変更する Server Action
 */
export async function batchUpdateIdeaStatus(
  ideaIds: string[],
  status: "public" | "unlisted" | "private" | "draft"
): Promise<ActionResult<{ successCount: number }>> {
  const t = await getServerErrors();
  const { db, session } = await getAuthenticatedDb();

  if (ideaIds.length === 0) return { error: t("version.batch.noSelection") };

  const targets = await getManageableIdeas(db, session, ideaIds);
  if (targets.length === 0) return { error: t("common.forbidden") };

  const targetIds = targets.map((p) => p.id);

  // 下書きから出るものは、その時点を作成日時に付け直す
  if (status !== "draft") {
    await db
      .update(posts)
      .set({ createdAt: new Date() })
      .where(and(inArray(posts.id, targetIds), eq(posts.visibility, "draft")))
      .run();
  }

  await db
    .update(posts)
    .set({ visibility: status, updatedAt: new Date() })
    .where(inArray(posts.id, targetIds))
    .run();

  revalidatePath("/ideas");
  revalidatePath("/ideas/manage");
  return { success: true, data: { successCount: targetIds.length } };
}

/**
 * 複数のアイデアの実現ステータスを一括変更する Server Action
 */
export async function batchUpdateIdeaResolution(
  ideaIds: string[],
  status: "open" | "in_progress" | "fulfilled"
): Promise<ActionResult<{ successCount: number }>> {
  const t = await getServerErrors();
  const { db, session } = await getAuthenticatedDb();

  if (ideaIds.length === 0) return { error: t("version.batch.noSelection") };
  if (!["open", "in_progress", "fulfilled"].includes(status)) {
    return { error: t("idea.invalidStatus") };
  }

  const targets = await getManageableIdeas(db, session, ideaIds);
  if (targets.length === 0) return { error: t("common.forbidden") };

  const targetIds = targets.map((p) => p.id);

  await db.batch([
    db.update(ideas).set({ status }).where(inArray(ideas.id, targetIds)),
    db.update(posts).set({ updatedAt: new Date() }).where(inArray(posts.id, targetIds)),
  ]);

  revalidatePath("/ideas");
  revalidatePath("/ideas/manage");
  return { success: true, data: { successCount: targetIds.length } };
}

/**
 * 複数のアイデアを一括削除する Server Action
 */
export async function batchDeleteIdeas(ideaIds: string[]): Promise<ActionResult<{ successCount: number }>> {
  const t = await getServerErrors();
  const { db, session } = await getAuthenticatedDb();

  if (ideaIds.length === 0) return { error: t("version.batch.noSelection") };

  const targets = await getManageableIdeas(db, session, ideaIds);
  if (targets.length === 0) return { error: t("common.forbidden") };

  const targetIds = targets.map((p) => p.id);

  // posts を削除すると ideas は cascade で消える
  await db.delete(posts).where(inArray(posts.id, targetIds)).run();
  await recordDeletion(db, "posts", targetIds);

  revalidatePath("/ideas");
  revalidatePath("/ideas/manage");
  return { success: true, data: { successCount: targetIds.length } };
}

/**
 * 単一アイデアのmcVersionsとloaders配列を処理する
 */
function computeNextArray(
  currentJson: string | null,
  operation: "add" | "remove" | "set",
  items: string[]
): string[] {
  let current: string[] = [];
  try {
    if (currentJson) current = JSON.parse(currentJson) as string[];
  } catch {}

  if (operation === "add") {
    return [...new Set([...current, ...items])];
  } else if (operation === "remove") {
    return current.filter((x) => !items.includes(x));
  } else {
    return [...items];
  }
}

/**
 * 単一アイデアのタグを処理する
 */
async function applyIdeaTags(
  db: Database,
  ideaId: string,
  operation: "add" | "remove" | "set",
  tags: string[]
) {
  if (operation === "set") {
    await db.delete(ideaTags).where(eq(ideaTags.ideaId, ideaId)).run();
    if (tags.length > 0) {
      await db.insert(ideaTags).values(tags.map((tag) => ({ ideaId, tag }))).run();
    }
  } else if (operation === "add") {
    const existing = await db.select({ tag: ideaTags.tag }).from(ideaTags).where(eq(ideaTags.ideaId, ideaId)).all();
    const existingSet = new Set(existing.map((e) => e.tag));
    const toAdd = tags.filter((t) => !existingSet.has(t));
    if (toAdd.length > 0) {
      await db.insert(ideaTags).values(toAdd.map((tag) => ({ ideaId, tag }))).run();
    }
  } else if (operation === "remove") {
    if (tags.length > 0) {
      await db.delete(ideaTags).where(and(eq(ideaTags.ideaId, ideaId), inArray(ideaTags.tag, tags))).run();
    }
  }
}

/**
 * 複数のアイデアに対して、メタデータ（MCバージョン、ローダー、タグ）を一括で追加・削除・設定する Server Action
 */
export async function batchModifyIdeaMetadata(
  ideaIds: string[],
  operation: "add" | "remove" | "set",
  mcVersions: string[],
  loaders: string[],
  tags: string[],
  targets: { mcVersions: boolean; loaders: boolean; tags: boolean }
): Promise<ActionResult<{ successCount: number }>> {
  const t = await getServerErrors();
  const { db, session } = await getAuthenticatedDb();

  if (ideaIds.length === 0) return { error: t("version.batch.noSelection") };

  const activeTargets = await getManageableIdeas(db, session, ideaIds);
  if (activeTargets.length === 0) return { error: t("common.forbidden") };

  const targetIds = activeTargets.map((p) => p.id);

  for (const id of targetIds) {
    const idea = await db.select().from(ideas).where(eq(ideas.id, id)).get();
    if (!idea) continue;

    const setClause: Record<string, any> = {};

    if (targets.mcVersions) {
      const nextMcs = computeNextArray(idea.mcVersions, operation, mcVersions);
      setClause.mcVersions = nextMcs.length > 0 ? JSON.stringify(nextMcs) : null;
    }
    if (targets.loaders) {
      const nextLoaders = computeNextArray(idea.loaders, operation, loaders);
      setClause.loaders = nextLoaders.length > 0 ? JSON.stringify(nextLoaders) : null;
    }

    if (Object.keys(setClause).length > 0) {
      await db.update(ideas).set(setClause).where(eq(ideas.id, id)).run();
    }

    if (targets.tags) {
      await applyIdeaTags(db, id, operation, tags);
    }
  }

  revalidatePath("/ideas");
  revalidatePath("/ideas/manage");
  return { success: true, data: { successCount: targetIds.length } };
}
