"use client";

import { useState } from "react";
import {
  findRecipeIdentitiesAction,
  getRecipeLimitsAction,
  setRecipeLimitsAction,
  resetRecipeQuotaAction,
  releaseRecipeNamespaceAction,
  type RecipeIdentity,
  type RecipeLimits,
} from "@/lib/actions/adminRecipeLimits";

type ActionResult<T> = { success: true; data: T } | { error: string };

/**
 * 投稿上限の管理画面の状態。
 *
 * 「探す → 選ぶ → 見る → 変える」の順に進みます。identity のIDは画面のどこにも出ないため、
 * 表示名から引く入口を必ず通します。
 */
export function useRecipeLimits() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [identities, setIdentities] = useState<RecipeIdentity[] | null>(null);
  const [limits, setLimits] = useState<RecipeLimits | null>(null);

  const [nsLimit, setNsLimit] = useState("");
  const [dailyLimit, setDailyLimit] = useState("");
  const [releaseNamespace, setReleaseNamespace] = useState("");

  /**
   * Server Action を実行し、失敗をこの画面のエラー表示へ落とします。
   * @param run 実行する処理
   * @returns 成功時の値。失敗時は null
   */
  const run = async <T,>(run: () => Promise<ActionResult<T>>): Promise<T | null> => {
    setLoading(true);
    setError("");
    try {
      const res = await run();
      if ("error" in res) {
        setError(res.error);
        return null;
      }
      return res.data;
    } finally {
      setLoading(false);
    }
  };

  const search = async () => {
    const found = await run(() => findRecipeIdentitiesAction(query));
    setIdentities(found ?? []);
  };

  /**
   * 投稿者を選び、上限と使用状況を読み込みます。
   * @param identityId レシピCDN上の identity ID
   */
  const select = async (identityId: string) => {
    const found = await run(() => getRecipeLimitsAction(identityId));
    setLimits(found);
    // 今の値を初期表示にすると「変更しない」と「同じ値を入れ直す」の区別が付かないため、空にします。
    setNsLimit("");
    setDailyLimit("");
  };

  /** 選択中の投稿者を読み直します。変更後の状態をその場で確かめるため。 */
  const reload = async () => {
    if (limits) await select(limits.identityId);
  };

  const applyLimits = async () => {
    if (!limits || (!nsLimit && !dailyLimit)) return;
    await run(() => setRecipeLimitsAction(limits.identityId, nsLimit, dailyLimit));
    await reload();
  };

  const resetQuota = async () => {
    if (!limits) return;
    await run(() => resetRecipeQuotaAction(limits.identityId));
    await reload();
  };

  const release = async () => {
    if (!releaseNamespace) return;
    await run(() => releaseRecipeNamespaceAction(releaseNamespace));
    setReleaseNamespace("");
    await reload();
  };

  return {
    loading,
    error,
    query,
    setQuery,
    identities,
    limits,
    nsLimit,
    setNsLimit,
    dailyLimit,
    setDailyLimit,
    releaseNamespace,
    setReleaseNamespace,
    search,
    select,
    applyLimits,
    resetQuota,
    release,
  };
}

export type RecipeLimitsState = ReturnType<typeof useRecipeLimits>;
