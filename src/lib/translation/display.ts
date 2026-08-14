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
  aiTranslationEnabled: boolean;
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
  // 限定公開の本文は LLM に渡さない。作者が機械翻訳を断っている場合も同様に出さない
  const isPublic = post.visibility === "public" && post.aiTranslationEnabled;
  if (!translation) return { ...original, canTranslate: isPublic };

  const stale = translation.sourceHash !== (await computeSourceHash(post));

  // 既訳があれば cached でも最初から訳文を出す。原文への切り替えは画面側で行う。
  // hreflang は manual のみに絞っているので、索引方針とは分けて扱える。
  return {
    title:      translation.title,
    body:       translation.body,
    bodyFormat: translation.bodyFormat,
    translated: true,
    state:      translation.state,
    stale,
    // 古い cached だけ訳し直せる。manual は作者の確定なので閲覧者からは再生成させない
    canTranslate: isPublic && stale && translation.state === "cached",
  };
}
