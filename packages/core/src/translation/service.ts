/**
 * 翻訳リクエストの実行。権限・レート制限・上限を検査し、既訳があれば LLM を
 * 経由せずに返す。API ルートと Server Action の共通入口。
 */
import { and, eq, inArray } from "drizzle-orm";
import { posts } from "@modparks/core/db/schema";
import type { Database } from "@modparks/core/db/client";
import { locales, type AppLocale } from "@modparks/core/i18n/locales";
import { translateContent } from "@modparks/core/translation/translate";
import { computeSourceHash } from "@modparks/core/translation/sourceHash";
import { countRunsSince, findTranslation, hasRecentFailure, recordRun, saveTranslation } from "@modparks/core/translation/repository";
import type { BodyFormat } from "@modparks/core/translation/masking";
import type { TranslationSettings } from "@modparks/core/translation/settings";
import type { TranslationProvider } from "@modparks/core/translation/providers/types";

/** 閲覧者が AI 翻訳を頼める投稿の種類。どちらも本文を posts に持つので同じ経路で訳せる */
const TRANSLATABLE_KINDS = ["project", "idea"] as const;

/** 同一対象で失敗した直後の再実行を抑える時間 */
const FAILURE_COOLDOWN_MS = 10 * 60 * 1000;
const RATE_LIMIT_ACTION = "translate";
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export type TranslationError =
  | "invalid_locale"
  | "not_found"
  | "not_public"
  | "rate_limited"
  | "too_long"
  | "cooling_down"
  | "invalid_output"
  | "provider_error"
  | "budget_exceeded"
  | "translation_disabled"
  | "feature_disabled";

/**
 * 翻訳に要る環境依存の部品。core は束縛や設定を自分で取りに行かないため、呼び出し側が揃えて渡す。
 */
export type TranslationDeps = {
  db: Database;
  /** アプリ設定（KV）の翻訳の分。LLM を呼ぶ前にだけ読む */
  getSettings: () => Promise<TranslationSettings>;
  provider: TranslationProvider;
  /** 利用者ごとの回数制限。IP の取り方が入口ごとに違うため受け取る */
  rateLimit: (action: string, limit: number, windowMs: number, userId: string) => Promise<{ success: boolean }>;
};

export type TranslationOutcome =
  | { ok: true; title: string; body: string; bodyFormat: BodyFormat; cached: boolean }
  | { ok: false; error: TranslationError };

/**
 * 指定ロケールの訳文を返す。無ければ生成してキャッシュする。
 * @param userId 実行者。ログインを必須にしているのは LLM 呼び出しの濫用を防ぐため
 */
export async function requestTranslation(
  deps: TranslationDeps,
  postId: string,
  locale: string,
  userId: string,
  /** 作者の「下書きし直す」用。既訳があっても訳し直す（結果は保存しない） */
  options: { regenerate?: boolean } = {},
): Promise<TranslationOutcome> {
  if (!locales.includes(locale as AppLocale)) return { ok: false, error: "invalid_locale" };

  const { db } = deps;
  const settings = await deps.getSettings();
  if (!settings.enabled) return { ok: false, error: "feature_disabled" };

  const post = await db.select().from(posts).where(and(eq(posts.id, postId), inArray(posts.kind, TRANSLATABLE_KINDS))).get();
  if (!post) return { ok: false, error: "not_found" };
  // 限定公開の本文を LLM や共有キャッシュに乗せない
  if (post.visibility !== "public") return { ok: false, error: "not_public" };
  if (post.sourceLocale === locale) return { ok: false, error: "invalid_locale" };
  // 作者が機械翻訳を望まない場合。既訳の表示は妨げないので、生成のみを止める
  if (!post.aiTranslationEnabled) return { ok: false, error: "translation_disabled" };

  const sourceHash = await computeSourceHash(post);
  if (options.regenerate) return runTranslation(deps, { post, locale, userId, sourceHash, settings, persist: false });

  const existing = await findTranslation(db, postId, locale);
  if (existing && existing.sourceHash === sourceHash) {
    return { ok: true, title: existing.title, body: existing.body, bodyFormat: existing.bodyFormat, cached: true };
  }
  if (existing?.state === "manual") {
    // 手動確定は原文が更新されても自動では訳し直さない（作者の明示操作でのみ更新する）
    return { ok: true, title: existing.title, body: existing.body, bodyFormat: existing.bodyFormat, cached: true };
  }
  return runTranslation(deps, { post, locale, userId, sourceHash, settings, persist: true });
}

interface RunContext {
  post: typeof posts.$inferSelect;
  locale: string;
  userId: string;
  sourceHash: string;
  settings: TranslationSettings;
  /** false なら結果を保存しない（作者が編集画面で確定するまで反映させないため） */
  persist: boolean;
}

/**
 * LLM を呼ぶ前の関門。失敗直後の抑制・利用者ごとの上限・全体の日次上限を順に見る。
 * 投稿本文とコメントで共通（上限は両者を合わせて数える）。
 * @returns 止める理由。呼んでよければ null
 */
export async function checkRunAllowed(
  { db, rateLimit }: TranslationDeps,
  target: { postId: string; commentId?: string },
  locale: string,
  userId: string,
  settings: TranslationSettings,
): Promise<TranslationError | null> {
  if (await hasRecentFailure(db, target, locale, FAILURE_COOLDOWN_MS)) return "cooling_down";

  const limited = await rateLimit(RATE_LIMIT_ACTION, settings.userHourlyLimit, RATE_LIMIT_WINDOW_MS, userId);
  if (!limited.success) return "rate_limited";
  if (await countRunsSince(db, startOfToday()) >= settings.dailyRunLimit) return "budget_exceeded";

  return null;
}

async function runTranslation(deps: TranslationDeps, ctx: RunContext): Promise<TranslationOutcome> {
  const { db } = deps;
  const { post, locale, userId, sourceHash, settings } = ctx;
  const blocked = await checkRunAllowed(deps, { postId: post.id }, locale, userId, settings);
  if (blocked) return { ok: false, error: blocked };

  const result = await translateWithLogging(deps, ctx);
  if (!result.ok) return { ok: false, error: result.reason };
  // タイトルは訳さないので原文をそのまま持つ
  if (!ctx.persist) {
    return { ok: true, title: post.title, body: result.body, bodyFormat: post.bodyFormat, cached: false };
  }

  await saveTranslation(db, {
    postId: post.id,
    locale,
    title: post.title,
    body: result.body,
    bodyFormat: post.bodyFormat,
    state: "cached",
    sourceHash,
  });
  return { ok: true, title: post.title, body: result.body, bodyFormat: post.bodyFormat, cached: false };
}

type LoggedResult =
  | { ok: true; body: string }
  | { ok: false; reason: "too_long" | "invalid_output" | "provider_error" };

/** LLM 呼び出しの結果は成否によらず translation_runs に残す */
async function translateWithLogging({ db, provider }: TranslationDeps, ctx: RunContext): Promise<LoggedResult> {
  const { post, locale, userId } = ctx;
  const base = { postId: post.id, locale, userId };
  try {
    const result = await translateContent({
      body:         post.body,
      bodyFormat:   post.bodyFormat,
      sourceLocale: post.sourceLocale,
      targetLocale: locale,
      settings:     ctx.settings,
      provider,
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
    console.error("translation provider failed:", e);
    await recordRun(db, {
      ...base,
      provider: "unknown", model: "unknown", inputChars: 0, outputChars: 0, status: "error",
    });
    return { ok: false, reason: "provider_error" };
  }
}

/** 日次上限の起点。UTC 日付で数える（Workers の実行環境に合わせる） */
function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

