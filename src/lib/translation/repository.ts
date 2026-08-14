/**
 * post_translations / translation_runs の読み書き。
 */
import { and, eq, gt, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { postTranslations, translationRuns } from "@/db/schema";
import type { Database } from "@/lib/db";
import type { PostTranslation } from "@/db/schema";
import type { BodyFormat } from "./masking";

export async function findTranslation(
  db: Database,
  postId: string,
  locale: string,
): Promise<PostTranslation | undefined> {
  return db
    .select()
    .from(postTranslations)
    .where(and(eq(postTranslations.postId, postId), eq(postTranslations.locale, locale)))
    .get();
}

export interface SaveTranslationInput {
  postId: string;
  locale: string;
  title: string;
  body: string;
  bodyFormat: BodyFormat;
  state: "cached" | "manual";
  sourceHash: string;
}

/** 同一 (postId, locale) は 1 行だけ持つため upsert する */
export async function saveTranslation(db: Database, input: SaveTranslationInput): Promise<void> {
  const now = new Date();
  await db
    .insert(postTranslations)
    .values({ ...input, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [postTranslations.postId, postTranslations.locale],
      set:    { ...input, updatedAt: now },
    });
}

export async function deleteTranslation(db: Database, postId: string, locale: string): Promise<void> {
  await db
    .delete(postTranslations)
    .where(and(eq(postTranslations.postId, postId), eq(postTranslations.locale, locale)));
}

export interface RunLog {
  postId: string;
  locale: string;
  userId: string;
  provider: string;
  model: string;
  inputChars: number;
  outputChars: number;
  status: "ok" | "invalid_output" | "error";
}

export async function recordRun(db: Database, log: RunLog): Promise<void> {
  await db.insert(translationRuns).values({ id: createId(), ...log, createdAt: new Date() });
}

/**
 * 直近に同じ対象で失敗しているかを見る。失敗直後の再実行を抑え、
 * 壊れた応答を繰り返し引くだけの無駄な課金を防ぐ。
 */
export async function hasRecentFailure(
  db: Database,
  postId: string,
  locale: string,
  windowMs: number,
): Promise<boolean> {
  const since = new Date(Date.now() - windowMs);
  const row = await db
    .select({ status: translationRuns.status })
    .from(translationRuns)
    .where(and(
      eq(translationRuns.postId, postId),
      eq(translationRuns.locale, locale),
      gt(translationRuns.createdAt, since),
    ))
    .orderBy(sql`${translationRuns.createdAt} desc`)
    .get();
  return row !== undefined && row.status !== "ok";
}

/** 月次予算の判定に使う、当月の LLM 呼び出し回数 */
export async function countRunsSince(db: Database, since: Date): Promise<number> {
  const row = await db
    .select({ count: sql<number>`count(*)` })
    .from(translationRuns)
    .where(gt(translationRuns.createdAt, since))
    .get();
  return row?.count ?? 0;
}
