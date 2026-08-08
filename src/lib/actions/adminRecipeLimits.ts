"use server";

import { callRecipeAdminApi } from "@/lib/services/recipeAdminApi";

/**
 * レシピCDN側の投稿上限（日次枠と namespace 所有）を扱う Server Action。
 *
 * 上限は投稿を止める側の仕組みなので、詰まった投稿者が出るたびにCLIを叩くのは現実的では
 * ありません。管理画面から状況を見て、その場で緩められるようにします。
 */

/** レシピCDN上の投稿者。 */
export type RecipeIdentity = { id: string; display_name: string; owned: number };

/** 所有している namespace の1件。 */
export type RecipeOwnedNamespace = { ns: string; trust: string; claimed_at: string };

/** identity に適用されている上限と使用状況。`-1` は無制限。 */
export type RecipeLimits = {
  identityId: string;
  day: string;
  used: number;
  limits: { nsLimit: number; dailyLimit: number };
  namespaces: RecipeOwnedNamespace[];
};

/**
 * 失敗をメッセージへ畳んで返します。
 *
 * 管理画面は「実行してログに1行出す」形なので、例外のままだと画面が落ちます。
 * @param run 実行する処理
 */
async function guarded<T>(run: () => Promise<T>): Promise<{ success: true; data: T } | { error: string }> {
  try {
    return { success: true, data: await run() };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to call recipe admin API" };
  }
}

/**
 * 表示名で投稿者を探します。
 * @param query 表示名（部分一致）
 */
export async function findRecipeIdentitiesAction(query: string) {
  return guarded(async () => {
    const data = await callRecipeAdminApi("/admin/identities", query ? { q: query } : undefined);
    return (data.identities ?? []) as RecipeIdentity[];
  });
}

/**
 * 投稿者の上限と使用状況を取得します。
 * @param identityId レシピCDN上の identity ID
 */
export async function getRecipeLimitsAction(identityId: string) {
  return guarded(async () => (await callRecipeAdminApi("/admin/limits", { identity: identityId })) as RecipeLimits);
}

/**
 * 投稿者の上限を上書きします。
 *
 * 空文字は「変更しない」、`default` は既定値へ戻す、`-1` は無制限です。
 * @param identityId レシピCDN上の identity ID
 * @param nsLimit namespace 所有の上限
 * @param dailyLimit 日次の投稿上限
 */
export async function setRecipeLimitsAction(identityId: string, nsLimit: string, dailyLimit: string) {
  return guarded(async () => {
    const params: Record<string, string> = { identity: identityId };
    if (nsLimit) params.ns = nsLimit;
    if (dailyLimit) params.daily = dailyLimit;
    return callRecipeAdminApi("/admin/limits/set", params);
  });
}

/**
 * その日の投稿枠を戻します。
 * @param identityId レシピCDN上の identity ID
 */
export async function resetRecipeQuotaAction(identityId: string) {
  return guarded(() => callRecipeAdminApi("/admin/limits/reset-quota", { identity: identityId }));
}

/**
 * namespace の所有を解除します。解除した namespace は次に投稿した人が先着で確保します。
 * @param namespace 解除するネームスペース
 */
export async function releaseRecipeNamespaceAction(namespace: string) {
  return guarded(() => callRecipeAdminApi("/admin/limits/release", { ns: namespace }));
}
