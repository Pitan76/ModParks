import { getAdminDb } from "@/lib/auth-helpers";

const getCdnUrl = () => process.env.NEXT_PUBLIC_RECIPE_CDN_URL || "https://recipe.modparks.pitan76.net";
const getCdnSecret = () => process.env.RECIPE_CDN_SECRET || "";

/**
 * modparks-recipe（レシピCDN）の管理者用APIを呼び出します。
 *
 * シークレットはサーバー側にしか無いため、この経路を通さないとブラウザから叩けません。
 * 権限確認もここで行い、呼び出し側が忘れられないようにしています。
 * @param path エンドポイントのパス（例: "/admin/reindex"）
 * @param searchParams クエリパラメータの辞書
 */
export async function callRecipeAdminApi(path: string, searchParams?: Record<string, string>) {
  const res = await fetch(await recipeAdminUrl(path, searchParams), { method: "GET", cache: "no-store" });
  if (!res.ok) {
    throw new Error(`API failed: ${res.status} ${res.statusText} - ${await res.text()}`);
  }

  const contentType = res.headers.get("content-type");
  if (contentType?.includes("application/json")) return res.json();
  return { message: await res.text() };
}

/**
 * 管理APIのURLを組み立てます。
 *
 * 画像のように JSON で返らない応答は呼び出し側が自分で読む必要があるため、URLだけを渡します。
 * 権限確認はここでも行います。
 * @param path エンドポイントのパス
 * @param searchParams クエリパラメータの辞書
 */
export async function recipeAdminUrl(path: string, searchParams?: Record<string, string>): Promise<string> {
  await getAdminDb();

  const url = new URL(path, getCdnUrl());
  url.searchParams.set("secret", getCdnSecret());
  for (const [key, val] of Object.entries(searchParams ?? {})) url.searchParams.set(key, val);
  return url.toString();
}
