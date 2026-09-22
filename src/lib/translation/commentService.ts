/**
 * コメントの AI 翻訳。投稿本文（service.ts）と上限・記録を共有し、訳文は comment_translations に置く。
 */
import { and, eq } from "drizzle-orm";
import { comments, commentTranslations, posts } from "@modparks/core/db/schema";
import type { Database } from "@/lib/db";
import { locales, type AppLocale } from "@modparks/core/i18n/locales";
import { detectSourceLocale } from "@modparks/core/translation/detectLocale";
import { computeSourceHash } from "@modparks/core/translation/sourceHash";
import type { BodyFormat } from "@modparks/core/translation/masking";
import { translateContent } from "./translate";
import { recordRun } from "./repository";
import { checkRunAllowed, type TranslationError } from "./service";
import { getTranslationSettings, type TranslationSettings } from "./settings";

export type CommentTranslationOutcome =
  | { ok: true; body: string; bodyFormat: BodyFormat; cached: boolean }
  | { ok: false; error: TranslationError };

type TargetComment = { id: string; postId: string; content: string; contentFormat: BodyFormat };

/** コメントには題が無いので、ハッシュは本文と書式だけで作る */
const hashOf = (comment: TargetComment) =>
  computeSourceHash({ title: "", body: comment.content, bodyFormat: comment.contentFormat });

/** 公開の投稿に付いたコメントだけを返す。限定公開の議論を LLM や共有キャッシュに乗せない */
async function loadPublicComment(db: Database, commentId: string) {
  return db
    .select({
      id: comments.id,
      postId: comments.postId,
      content: comments.content,
      contentFormat: comments.contentFormat,
      visibility: posts.visibility,
    })
    .from(comments)
    .innerJoin(posts, eq(posts.id, comments.postId))
    .where(eq(comments.id, commentId))
    .get();
}

/**
 * 指定ロケールのコメント訳文を返す。無い、または原文が編集されていれば生成して保存する。
 * @param userId 実行者。ログインを必須にしているのは LLM 呼び出しの濫用を防ぐため
 */
export async function requestCommentTranslation(
  db: Database,
  commentId: string,
  locale: string,
  userId: string,
): Promise<CommentTranslationOutcome> {
  if (!locales.includes(locale as AppLocale)) return { ok: false, error: "invalid_locale" };

  const settings = await getTranslationSettings();
  if (!settings.enabled) return { ok: false, error: "feature_disabled" };

  const comment = await loadPublicComment(db, commentId);
  if (!comment) return { ok: false, error: "not_found" };
  if (comment.visibility !== "public") return { ok: false, error: "not_public" };
  if (detectSourceLocale(comment.content) === locale) return { ok: false, error: "invalid_locale" };

  const sourceHash = await hashOf(comment);
  const existing = await db
    .select()
    .from(commentTranslations)
    .where(and(eq(commentTranslations.commentId, commentId), eq(commentTranslations.locale, locale)))
    .get();
  if (existing?.sourceHash === sourceHash) {
    return { ok: true, body: existing.body, bodyFormat: existing.bodyFormat, cached: true };
  }

  return runCommentTranslation(db, comment, locale, userId, settings, sourceHash);
}

async function runCommentTranslation(
  db: Database,
  comment: TargetComment,
  locale: string,
  userId: string,
  settings: TranslationSettings,
  sourceHash: string,
): Promise<CommentTranslationOutcome> {
  const target = { postId: comment.postId, commentId: comment.id };
  const blocked = await checkRunAllowed(db, target, locale, userId, settings);
  if (blocked) return { ok: false, error: blocked };

  const result = await translateWithLogging(db, comment, locale, userId, settings);
  if (!result.ok) return { ok: false, error: result.reason };

  const now = new Date();
  const row = { commentId: comment.id, locale, body: result.body, bodyFormat: comment.contentFormat, sourceHash };
  await db
    .insert(commentTranslations)
    .values({ ...row, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [commentTranslations.commentId, commentTranslations.locale],
      set:    { ...row, updatedAt: now },
    });

  return { ok: true, body: result.body, bodyFormat: comment.contentFormat, cached: false };
}

/** LLM 呼び出しの結果は成否によらず translation_runs に残す（投稿本文と同じ） */
async function translateWithLogging(
  db: Database,
  comment: TargetComment,
  locale: string,
  userId: string,
  settings: TranslationSettings,
): Promise<{ ok: true; body: string } | { ok: false; reason: "too_long" | "invalid_output" | "provider_error" }> {
  const base = { postId: comment.postId, commentId: comment.id, locale, userId };
  try {
    const result = await translateContent({
      body:         comment.content,
      bodyFormat:   comment.contentFormat,
      sourceLocale: detectSourceLocale(comment.content),
      targetLocale: locale,
      settings,
    });
    await recordRun(db, {
      ...base,
      provider:    result.provider,
      model:       result.model,
      inputChars:  result.inputChars,
      outputChars: result.outputChars,
      status:      result.ok ? "ok" : result.reason === "too_long" ? "error" : "invalid_output",
    });
    if (!result.ok) return { ok: false, reason: result.reason };
    return { ok: true, body: result.body };
  } catch (e) {
    // 外部 I/O 境界。プロバイダ側の障害はここで記録し、閲覧者には原文を出す
    console.error("comment translation provider failed:", e);
    await recordRun(db, { ...base, provider: "unknown", model: "unknown", inputChars: 0, outputChars: 0, status: "error" });
    return { ok: false, reason: "provider_error" };
  }
}
