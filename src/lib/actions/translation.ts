"use server";

import { revalidatePath } from "next/cache";
import * as manage from "@modparks/core/translation/manage";
import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { nextTranslationDeps } from "@/lib/translation/deps";

/**
 * 作者による訳文の管理（Server Action）。本体は core/translation/manage.ts。
 */

/** 編集画面に渡す訳文の一覧。stale かどうかもここで判定して返す */
export async function listProjectTranslations(projectId: string) {
  const { db, userId } = await getAuthenticatedDb();
  return manage.listProjectTranslations(db, userId, projectId);
}

/** 作者が訳文を確定する。以後この言語は自動再翻訳の対象から外れる */
export async function saveManualTranslation(projectId: string, locale: string, title: string, body: string) {
  const { db, userId } = await getAuthenticatedDb();
  const { slug } = await manage.saveManualTranslation(db, userId, projectId, locale, title, body);
  revalidatePath(`/projects/${slug}`);
}

/** 手動訳の取り下げ。以後はその言語で閲覧者主導の自動翻訳が働く */
export async function removeTranslation(projectId: string, locale: string) {
  const { db, userId } = await getAuthenticatedDb();
  const { slug } = await manage.removeTranslation(db, userId, projectId, locale);
  revalidatePath(`/projects/${slug}`);
}

/** 編集画面用の AI 下書き。保存はせず訳文だけを返す */
export async function draftTranslation(projectId: string, locale: string) {
  const { db, userId } = await getAuthenticatedDb();
  return manage.draftTranslation(nextTranslationDeps(db), userId, projectId, locale);
}
