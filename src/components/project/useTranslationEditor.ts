"use client";

import { useCallback, useState } from "react";
import {
  draftTranslation,
  listProjectTranslations,
  removeTranslation,
  saveManualTranslation,
} from "@/lib/actions/translation";
import type { TranslationDraft } from "./TranslationAccordion";

interface EditorState {
  drafts: TranslationDraft[];
  available: string[];
  canDraft: boolean;
  busy: boolean;
  error: string | null;
}

const INITIAL: EditorState = { drafts: [], available: [], canDraft: false, busy: false, error: null };

/** 訳文編集の状態と Server Action 呼び出し。画面側は表示だけを持つ */
export function useTranslationEditor(projectId: string) {
  const [state, setState] = useState<EditorState>(INITIAL);

  const load = useCallback(async () => {
    const data = await listProjectTranslations(projectId);
    setState((prev) => ({
      ...prev,
      available: data.available,
      canDraft:  data.canDraft,
      drafts:    data.translations,
    }));
  }, [projectId]);

  const update = (next: TranslationDraft) =>
    setState((prev) => ({
      ...prev,
      drafts: prev.drafts.map((d) => (d.locale === next.locale ? next : d)),
    }));

  const add = (locale: string) =>
    setState((prev) => ({
      ...prev,
      drafts: [...prev.drafts, { locale, title: "", body: "", state: null, stale: false }],
    }));

  /** 実行中フラグとエラーの面倒を 1 箇所に寄せる */
  const withBusy = async (fn: () => Promise<string | null>) => {
    setState((prev) => ({ ...prev, busy: true, error: null }));
    const error = await fn();
    setState((prev) => ({ ...prev, busy: false, error }));
  };

  const save = (locale: string) => withBusy(async () => {
    const target = state.drafts.find((d) => d.locale === locale);
    if (!target) return null;
    await saveManualTranslation(projectId, locale, target.title, target.body);
    await load();
    return null;
  });

  const remove = (locale: string) => withBusy(async () => {
    await removeTranslation(projectId, locale);
    setState((prev) => ({ ...prev, drafts: prev.drafts.filter((d) => d.locale !== locale) }));
    return null;
  });

  const draft = (locale: string) => withBusy(async () => {
    const result = await draftTranslation(projectId, locale);
    if (result.error) return result.error;
    if (!result.title) return "provider_error";
    setState((prev) => ({
      ...prev,
      drafts: prev.drafts.map((d) =>
        d.locale === locale ? { ...d, title: result.title, body: result.body } : d),
    }));
    return null;
  });

  return { state, load, update, add, save, remove, draft };
}
