/**
 * 表示ロケールに応じて、原文と訳文のどちらを出すかを解決する。
 * ここでは LLM を呼ばない（呼ぶのは閲覧者の明示操作を受けた service 側だけ）。
 */
import type { Database } from "@/lib/db";
import { computeSourceHash } from "./sourceHash";
import { findTranslation } from "./repository";
import type { BodyFormat } from "./masking";

export interface DisplaySource {
  id: string;
  title: string;
  body: string;
  bodyFormat: BodyFormat;
  sourceLocale: string;
  visibility: string;
}

export interface DisplayContent {
  title: string;
  body: string;
  bodyFormat: BodyFormat;
  /** 訳文を出しているか。false なら原文 */
  translated: boolean;
  state: "cached" | "manual" | null;
  /** 訳文が現在の原文より古いか */
  stale: boolean;
  /** 閲覧者に AI 翻訳リンクを出してよいか */
  canTranslate: boolean;
}

export async function resolveDisplayContent(
  db: Database,
  post: DisplaySource,
  locale: string,
): Promise<DisplayContent> {
  const original: DisplayContent = {
    title: post.title, body: post.body, bodyFormat: post.bodyFormat,
    translated: false, state: null, stale: false, canTranslate: false,
  };
  if (locale === post.sourceLocale) return original;

  const translation = await findTranslation(db, post.id, locale);
  // 限定公開の本文は LLM に渡さないため、翻訳リンク自体を出さない
  const isPublic = post.visibility === "public";
  if (!translation) return { ...original, canTranslate: isPublic };

  const stale = translation.sourceHash !== (await computeSourceHash(post));

  // cached は SSR に載せない（自動生成文を各言語版として索引させないため）。
  // 既訳があればリンクは即座に解決し、LLM は呼ばれない。
  if (translation.state === "cached") {
    return { ...original, state: "cached", stale, canTranslate: isPublic };
  }

  return {
    title:      translation.title,
    body:       translation.body,
    bodyFormat: translation.bodyFormat,
    translated: true,
    state:      "manual",
    stale,
    // manual は作者の確定なので、閲覧者からは訳し直させない
    canTranslate: false,
  };
}
