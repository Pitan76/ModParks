"use server";

import * as core from "@modparks/core/versions/recipes";
import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { nextJarClient } from "@/lib/services/jar";
import { getServerErrors } from "@/lib/i18n/serverErrors";
import { revalidatePath } from "next/cache";

/**
 * レシピ抽出（Server Action）。本体は core/versions/recipes.ts。
 */
async function recipeDeps() {
  const { db, userId } = await getAuthenticatedDb();
  const deps: core.RecipeDeps = {
    db,
    t: await getServerErrors(),
    jar: nextJarClient,
    r2PublicUrl: process.env.R2_PUBLIC_URL,
    cdn: {
      url: process.env.NEXT_PUBLIC_RECIPE_CDN_URL || "https://recipe.modparks.pitan76.net",
      useApi: process.env.USE_RECIPE_CDN_API === "true",
      secret: process.env.RECIPE_CDN_SECRET,
    },
  };

  return { deps, userId };
}

function finish(result: Awaited<ReturnType<typeof core.extractRecipesFromVersion>>) {
  if ("error" in result) return result;

  revalidatePath(`/projects/${result.slug}`);
  revalidatePath(`/[locale]/projects/${result.slug}`, "page");
  return { success: true, count: result.count };
}

/** JARファイル内のレシピを抽出し、CDN/R2にアップロードしてプロジェクトに関連付ける */
export const extractRecipesFromVersion = async (versionId: string, projectSlug: string) => {
  const { deps, userId } = await recipeDeps();
  return finish(await core.extractRecipesFromVersion(deps, userId, versionId, projectSlug));
};

/** ブラウザで抽出されたレシピ・テクスチャを CDN に中継アップロードしてプロジェクトに関連付ける */
export const uploadClientExtractedRecipes = async (versionId: string, projectSlug: string, byNs: Parameters<typeof core.uploadClientExtractedRecipes>[4]) => {
  const { deps, userId } = await recipeDeps();
  return finish(await core.uploadClientExtractedRecipes(deps, userId, versionId, projectSlug, byNs));
};
