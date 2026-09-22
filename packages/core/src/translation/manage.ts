import { eq } from "drizzle-orm";
import type { Database } from "@modparks/core/db/client";
import { posts, postTranslations, type PostTranslation } from "@modparks/core/db/schema";
import { locales, type AppLocale } from "@modparks/core/i18n/locales";
import { canEditProject } from "@modparks/core/projects/access";
import { computeSourceHash } from "@modparks/core/translation/sourceHash";
import { deleteTranslation, saveTranslation } from "@modparks/core/translation/repository";
import { requestTranslation, type TranslationDeps } from "@modparks/core/translation/service";

/**
 * 作者による訳文の管理の本体。Next の Server Action と modparks-api の両方から呼ぶ。
 *
 * 閲覧者向けの自動翻訳と違い、ここで保存したものは `manual` として扱われ、
 * 原文更新でも自動では上書きされない。見つからない・権限なしは移設前と同じく例外で伝える。
 * 戻り値の slug はキャッシュを無効化する呼び出し側のためのもの。
 */

async function loadEditablePost(db: Database, projectId: string, userId: string) {
  const post = await db.select().from(posts).where(eq(posts.id, projectId)).get();
  if (!post) throw new Error("Project not found");
  if (!(await canEditProject(db, post, userId))) throw new Error("Forbidden");

  return post;
}

/** 編集画面に渡す訳文の一覧。stale かどうかもここで判定して返す */
export async function listProjectTranslations(db: Database, userId: string, projectId: string) {
  const post = await loadEditablePost(db, projectId, userId);

  const rows = await db
    .select()
    .from(postTranslations)
    .where(eq(postTranslations.postId, projectId))
    .all();
  const currentHash = await computeSourceHash(post);

  return {
    sourceLocale: post.sourceLocale,
    /** 公開プロジェクトでなければ LLM に本文を渡さないため、下書き生成も出さない */
    canDraft:     post.visibility === "public" && post.aiTranslationEnabled,
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
export async function saveManualTranslation(db: Database, userId: string, projectId: string, locale: string, title: string, body: string) {
  const post = await loadEditablePost(db, projectId, userId);
  if (!locales.includes(locale as AppLocale) || locale === post.sourceLocale) throw new Error("Invalid locale");

  await saveTranslation(db, {
    postId:     projectId,
    locale,
    title,
    body,
    bodyFormat: post.bodyFormat,
    state:      "manual",
    sourceHash: await computeSourceHash(post),
  });

  return { slug: post.slug };
}

/** 手動訳の取り下げ。以後はその言語で閲覧者主導の自動翻訳が働く */
export async function removeTranslation(db: Database, userId: string, projectId: string, locale: string) {
  const post = await loadEditablePost(db, projectId, userId);
  await deleteTranslation(db, projectId, locale);

  return { slug: post.slug };
}

/**
 * 編集画面用の AI 下書き。保存はせず訳文だけを返す。
 * 実体は閲覧者向けと同じ経路なので、上限・レート制限・記法検証も共通に効く。
 */
export async function draftTranslation(deps: TranslationDeps, userId: string, projectId: string, locale: string) {
  await loadEditablePost(deps.db, projectId, userId);

  const result = await requestTranslation(deps, projectId, locale, userId, { regenerate: true });
  if (!result.ok) return { error: result.error };
  return { title: result.title, body: result.body };
}
