/**
 * 翻訳リクエストの実行。権限・レート制限・上限を検査し、既訳があれば LLM を
 * 経由せずに返す。API ルートと Server Action の共通入口。
 */
import { and, eq } from "drizzle-orm";
import { posts } from "@/db/schema";
import type { Database } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { locales, type AppLocale } from "@/lib/i18n/routing";
import { translateContent, MAX_INPUT_CHARS } from "./translate";
import { computeSourceHash } from "./sourceHash";
import { countRunsSince, findTranslation, hasRecentFailure, recordRun, saveTranslation } from "./repository";
import type { BodyFormat } from "./masking";

/** 同一対象で失敗した直後の再実行を抑える時間 */
const FAILURE_COOLDOWN_MS = 10 * 60 * 1000;
const RATE_LIMIT = { action: "translate", limit: 20, windowMs: 60 * 60 * 1000 };

/**
 * サイト全体の 1 日あたりの LLM 実行回数。
 *
 * 試験運用のあいだは Workers AI の無料枠（日次の Neurons 割当）に収める。
 * 1 実行で title / body の 2 回呼び出しが走るため、割当を使い切らない側に倒した値。
 * 超えた日は翻訳を止め、原文表示のまま案内する（課金へは踏み込まない）。
 */
const DAILY_RUN_LIMIT = 50;

export type TranslationError =
  | "invalid_locale"
  | "not_found"
  | "not_public"
  | "rate_limited"
  | "too_long"
  | "cooling_down"
  | "invalid_output"
  | "provider_error"
  | "budget_exceeded";

export type TranslationOutcome =
  | { ok: true; title: string; body: string; bodyFormat: BodyFormat; cached: boolean }
  | { ok: false; error: TranslationError };

/**
 * 指定ロケールの訳文を返す。無ければ生成してキャッシュする。
 * @param userId 実行者。ログインを必須にしているのは LLM 呼び出しの濫用を防ぐため
 */
export async function requestTranslation(
  db: Database,
  postId: string,
  locale: string,
  userId: string,
  /** 作者の「下書きし直す」用。既訳があっても訳し直す（結果は保存しない） */
  options: { regenerate?: boolean } = {},
): Promise<TranslationOutcome> {
  if (!locales.includes(locale as AppLocale)) return { ok: false, error: "invalid_locale" };

  const post = await db.select().from(posts).where(and(eq(posts.id, postId), eq(posts.kind, "project"))).get();
  if (!post) return { ok: false, error: "not_found" };
  // 限定公開の本文を LLM や共有キャッシュに乗せない
  if (post.visibility !== "public") return { ok: false, error: "not_public" };
  if (post.sourceLocale === locale) return { ok: false, error: "invalid_locale" };

  const sourceHash = await computeSourceHash(post);
  if (options.regenerate) return runTranslation(db, { post, locale, userId, sourceHash, persist: false });

  const existing = await findTranslation(db, postId, locale);
  if (existing && existing.sourceHash === sourceHash) {
    return { ok: true, title: existing.title, body: existing.body, bodyFormat: existing.bodyFormat, cached: true };
  }
  if (existing?.state === "manual") {
    // 手動確定は原文が更新されても自動では訳し直さない（作者の明示操作でのみ更新する）
    return { ok: true, title: existing.title, body: existing.body, bodyFormat: existing.bodyFormat, cached: true };
  }
  return runTranslation(db, { post, locale, userId, sourceHash, persist: true });
}

interface RunContext {
  post: typeof posts.$inferSelect;
  locale: string;
  userId: string;
  sourceHash: string;
  /** false なら結果を保存しない（作者が編集画面で確定するまで反映させないため） */
  persist: boolean;
}

async function runTranslation(db: Database, ctx: RunContext): Promise<TranslationOutcome> {
  const { post, locale, userId, sourceHash } = ctx;
  if (await hasRecentFailure(db, post.id, locale, FAILURE_COOLDOWN_MS)) {
    return { ok: false, error: "cooling_down" };
  }
  const limited = await checkRateLimit(RATE_LIMIT.action, RATE_LIMIT.limit, RATE_LIMIT.windowMs, userId);
  if (!limited.success) return { ok: false, error: "rate_limited" };
  if (await countRunsSince(db, startOfToday()) >= DAILY_RUN_LIMIT) {
    return { ok: false, error: "budget_exceeded" };
  }

  const result = await translateWithLogging(db, ctx);
  if (!result.ok) return { ok: false, error: result.reason };
  if (!ctx.persist) {
    return { ok: true, title: result.title, body: result.body, bodyFormat: post.bodyFormat, cached: false };
  }

  await saveTranslation(db, {
    postId: post.id,
    locale,
    title: result.title,
    body: result.body,
    bodyFormat: post.bodyFormat,
    state: "cached",
    sourceHash,
  });
  return { ok: true, title: result.title, body: result.body, bodyFormat: post.bodyFormat, cached: false };
}

type LoggedResult =
  | { ok: true; title: string; body: string }
  | { ok: false; reason: "too_long" | "invalid_output" | "provider_error" };

/** LLM 呼び出しの結果は成否によらず translation_runs に残す */
async function translateWithLogging(db: Database, ctx: RunContext): Promise<LoggedResult> {
  const { post, locale, userId } = ctx;
  const base = { postId: post.id, locale, userId };
  try {
    const result = await translateContent({
      title:        post.title,
      body:         post.body,
      bodyFormat:   post.bodyFormat,
      sourceLocale: post.sourceLocale,
      targetLocale: locale,
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
    return { ok: true, title: result.title, body: result.body };
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

export { MAX_INPUT_CHARS, DAILY_RUN_LIMIT };
