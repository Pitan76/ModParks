"use server";

import { getAdminDb } from "@/lib/auth-helpers";

const getCdnUrl = () => process.env.NEXT_PUBLIC_RECIPE_CDN_URL || "https://recipe.modparks.pitan76.net";
const getCdnSecret = () => process.env.RECIPE_CDN_SECRET || "";

/**
 * modparks-recipe (レシピCDN) の管理者用APIを呼び出します。
 * @param path エンドポイントのパス (例: "/admin/reindex")
 * @param searchParams クエリパラメータの辞書
 */
async function callRecipeAdminApi(path: string, searchParams?: Record<string, string>) {
  // 管理者権限のチェック。権限がなければエラーを投げる
  await getAdminDb();

  const baseUrl = getCdnUrl();
  const secret = getCdnSecret();

  const url = new URL(path, baseUrl);
  url.searchParams.set("secret", secret);
  if (searchParams) {
    for (const [key, val] of Object.entries(searchParams)) {
      url.searchParams.set(key, val);
    }
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API failed: ${res.status} ${res.statusText} - ${text}`);
  }

  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return res.json();
  }
  return { message: await res.text() };
}

/**
 * レシピインデックスを再構築します。
 */
export async function reindexRecipesAction() {
  try {
    const data = await callRecipeAdminApi("/admin/reindex");
    return { success: true, data };
  } catch (err: any) {
    return { error: err.message };
  }
}

/**
 * 特定のネームスペースのキャッシュを破棄し、アセットバージョンを更新します。
 */
export async function purgeRecipeCacheAction(namespace: string) {
  if (!namespace) return { error: "Namespace is required" };
  try {
    const data = await callRecipeAdminApi(`/admin/purge/${namespace}`);
    return { success: true, data };
  } catch (err: any) {
    return { error: err.message };
  }
}

/**
 * 失効した取り込みセッションを一掃します。
 */
export async function sweepIngestsAction() {
  try {
    const data = await callRecipeAdminApi("/admin/sweep-ingests");
    return { success: true, data };
  } catch (err: any) {
    return { error: err.message };
  }
}

/**
 * 特定のネームスペースおよびフォルダー配下のアセットをクリーンアップします。
 */
export async function cleanNamespaceFolderAction(namespace: string, folder: string) {
  if (!namespace || !folder) return { error: "Namespace and folder are required" };
  try {
    const data = await callRecipeAdminApi(`/admin/clean/${namespace}/${folder}`);
    return { success: true, data };
  } catch (err: any) {
    return { error: err.message };
  }
}

/**
 * バージョン未設定 of ネームスペースに初期バージョンを設定します。
 */
export async function seedAssetVersionsAction() {
  try {
    const data = await callRecipeAdminApi("/admin/seed-versions");
    return { success: true, data };
  } catch (err: any) {
    return { error: err.message };
  }
}

/**
 * R2内のオブジェクト一覧を取得します。
 */
export async function listR2ObjectsAction(prefix?: string, limit?: number, cursor?: string) {
  const params: Record<string, string> = {};
  if (prefix) params.prefix = prefix;
  if (limit) params.limit = String(limit);
  if (cursor) params.cursor = cursor;

  try {
    const data = await callRecipeAdminApi("/admin/ls", params);
    return { success: true, data };
  } catch (err: any) {
    return { error: err.message };
  }
}

/**
 * 3Dアイコンのレンダリングをテストし、画像データURLまたはSVGソースを返します。
 */
export async function render3dIconAction(namespace: string, path: string, format?: "svg" | "png") {
  if (!namespace || !path) return { error: "Namespace and path are required" };

  try {
    await getAdminDb();

    const baseUrl = getCdnUrl();
    const secret = getCdnSecret();
    const url = new URL(`/admin/render3d/${namespace}/${path}`, baseUrl);
    url.searchParams.set("secret", secret);
    if (format) url.searchParams.set("format", format);

    const res = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API failed: ${res.status} ${res.statusText} - ${text}`);
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("image/svg+xml")) {
      const svgText = await res.text();
      return { success: true, format: "svg", data: svgText };
    } else {
      const buffer = await res.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      return { success: true, format: "png", data: `data:image/png;base64,${base64}` };
    }
  } catch (err: any) {
    return { error: err.message };
  }
}
