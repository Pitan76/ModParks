"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getAuthenticatedDb, assertProjectAccess } from "@/lib/auth-helpers";
import { posts, postTranslations } from "@/db/schema";
import { locales, type AppLocale } from "@/lib/i18n/routing";
import { computeSourceHash } from "@/lib/translation/sourceHash";
import { deleteTranslation, saveTranslation } from "@/lib/translation/repository";
import { requestTranslation } from "@/lib/translation/service";
import type { PostTranslation } from "@/db/schema";

/**
 * 作者による訳文の管理。閲覧者向けの自動翻訳と違い、ここで保存したものは
 * `manual` として扱われ、原文更新でも自動では上書きされない。
 */

/** 編集画面に渡す訳文の一覧。stale かどうかもここで判定して返す */
export async function listProjectTranslations(projectId: string) {
  const { db, session } = await getAuthenticatedDb();
  const post = await db.select().from(posts).where(eq(posts.id, projectId)).get();
  if (!post) throw new Error("Project not found");
  await assertProjectAccess(db, post, session);

  const rows = await db
    .select()
    .from(postTranslations)
    .where(eq(postTranslations.postId, projectId))
    .all();
  const currentHash = await computeSourceHash(post);

  return {
    sourceLocale: post.sourceLocale,
    /** 公開プロジェクトでなければ LLM に本文を渡さないため、下書き生成も出さない */
    canDraft:     post.visibility === "public",
    available:    locales.filter((l) => l !== post.sourceLocale),
    translations: rows.map((row: PostTranslation) => ({
      locale: row.locale,
      title:  row.title,
      body:   row.body,
      state:  row.state,
      stale:  row.sourceHash !== currentHash,
    })),
  };
}

/** 作者が訳文を確定する。以後この言語は自動再翻訳の対象から外れる */
export async function saveManualTranslation(
  projectId: string,
  locale: string,
  title: string,
  body: string,
) {
  const { db, session } = await getAuthenticatedDb();
  const post = await db.select().from(posts).where(eq(posts.id, projectId)).get();
  if (!post) throw new Error("Project not found");
  await assertProjectAccess(db, post, session);
  if (!locales.includes(locale as AppLocale) || locale === post.sourceLocale) {
    throw new Error("Invalid locale");
  }

  await saveTranslation(db, {
    postId:     projectId,
    locale,
    title,
    body,
    bodyFormat: post.bodyFormat,
    state:      "manual",
    sourceHash: await computeSourceHash(post),
  });
  revalidatePath(`/projects/${post.slug}`);
}

/** 手動訳の取り下げ。以後はその言語で閲覧者主導の自動翻訳が働く */
export async function removeTranslation(projectId: string, locale: string) {
  const { db, session } = await getAuthenticatedDb();
  const post = await db.select().from(posts).where(eq(posts.id, projectId)).get();
  if (!post) throw new Error("Project not found");
  await assertProjectAccess(db, post, session);

  await deleteTranslation(db, projectId, locale);
  revalidatePath(`/projects/${post.slug}`);
}

/**
 * 編集画面用の AI 下書き。保存はせず訳文だけを返す。
 * 実体は閲覧者向けと同じ経路なので、上限・レート制限・記法検証も共通に効く。
 */
export async function draftTranslation(projectId: string, locale: string) {
  const { db, session, userId } = await getAuthenticatedDb();
  const post = await db.select().from(posts).where(eq(posts.id, projectId)).get();
  if (!post) throw new Error("Project not found");
  await assertProjectAccess(db, post, session);

  const result = await requestTranslation(db, projectId, locale, userId, { regenerate: true });
  if (!result.ok) return { error: result.error };
  return { title: result.title, body: result.body };
}
