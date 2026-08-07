"use server";

import { getAuthenticatedDb, assertProjectAccess } from "@/lib/auth-helpers";
import { projects, projectHiddenRecipes, projectRecipeNames } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getHiddenRecipeIds } from "@/lib/queries/hiddenRecipes";
import { getCustomRecipeNames } from "@/lib/queries/recipeNames";
import { fetchRecipeLists, toRecipeItems } from "@/lib/services/recipeList";
import { findProjectPostBySlug } from "@/lib/queries/post";

/**
 * 1文に載せるレシピIDの数。D1 は 1クエリあたりのバインド変数が 100 個までなので、
 * 「行数」ではなく「バインド変数の数」で分割する必要がある。
 * INSERT は 1行につき project_id / recipe_id / hidden_by の 3 個、
 * DELETE は project_id の 1 個に加えて IN (...) の中身が 1 件 1 個。
 */
const D1_MAX_BOUND_PARAMS = 100;
const INSERT_CHUNK_SIZE = Math.floor(D1_MAX_BOUND_PARAMS / 3); // 33行 = 99個
const DELETE_CHUNK_SIZE = D1_MAX_BOUND_PARAMS - 1; // 99件 + project_id = 100個

/**
 * プロジェクトのレシピ表示設定を扱う Server Action。
 *
 * レシピの実体はレシピCDN（mp-recipe）が jar 由来で持つため、ここでは「出さない」判断だけを保存します。
 * jar を入れ直しても非表示設定が消えないのはこのためです。
 */

/**
 * 対象プロジェクトを取得し、操作権限を検証します。
 * @param slug プロジェクトのスラッグ
 * @returns プロジェクトと操作者のセッション
 */
async function authorizeProject(slug: string) {
  const { db, session } = await getAuthenticatedDb();

  const project = await findProjectPostBySlug(db, slug);
  if (!project) throw new Error("Project not found");

  await assertProjectAccess(db, project, session);
  return { db, session, project };
}

/**
 * レシピの表示・非表示を切り替えます。
 * @param slug プロジェクトのスラッグ
 * @param recipeId 完全修飾レシピID（例 "mymod:widget"）
 * @param hidden 非表示にするなら true
 */
export async function setRecipeHiddenAction(slug: string, recipeId: string, hidden: boolean) {
  if (!recipeId) return { error: "Recipe id is required" };

  try {
    const { db, session, project } = await authorizeProject(slug);

    if (hidden) {
      await db
        .insert(projectHiddenRecipes)
        .values({ projectId: project.id, recipeId, hiddenBy: session.user.id })
        .onConflictDoNothing()
        .run();
    } else {
      await db
        .delete(projectHiddenRecipes)
        .where(
          and(
            eq(projectHiddenRecipes.projectId, project.id),
            eq(projectHiddenRecipes.recipeId, recipeId)
          )
        )
        .run();
    }

    revalidatePath(`/projects/${slug}`);
    return { success: true, hidden };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to update recipe visibility" };
  }
}

/**
 * 複数のレシピの表示・非表示をまとめて切り替えます。
 * 1件ずつのラウンドトリップだと「すべて非表示」の操作が現実的でないため用意しています。
 * @param slug プロジェクトのスラッグ
 * @param recipeIds 完全修飾レシピIDの配列
 * @param hidden 非表示にするなら true
 */
export async function setRecipesHiddenAction(slug: string, recipeIds: string[], hidden: boolean) {
  if (recipeIds.length === 0) return { success: true, hidden };

  try {
    const { db, session, project } = await authorizeProject(slug);

    const chunkSize = hidden ? INSERT_CHUNK_SIZE : DELETE_CHUNK_SIZE;
    for (let i = 0; i < recipeIds.length; i += chunkSize) {
      const chunk = recipeIds.slice(i, i + chunkSize);
      if (hidden) {
        await db
          .insert(projectHiddenRecipes)
          .values(
            chunk.map((recipeId) => ({
              projectId: project.id,
              recipeId,
              hiddenBy: session.user.id,
            }))
          )
          .onConflictDoNothing()
          .run();
        continue;
      }
      await db
        .delete(projectHiddenRecipes)
        .where(
          and(
            eq(projectHiddenRecipes.projectId, project.id),
            inArray(projectHiddenRecipes.recipeId, chunk)
          )
        )
        .run();
    }

    revalidatePath(`/projects/${slug}`);
    return { success: true, hidden };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to update recipe visibility" };
  }
}

/**
 * プロジェクトで非表示設定されているレシピのID一覧を取得します。
 * @param projectId プロジェクトID
 */
export async function getHiddenRecipeIdsAction(projectId: string) {
  try {
    const hiddenSet = await getHiddenRecipeIds(projectId);
    return { success: true, hiddenIds: Array.from(hiddenSet) };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to fetch hidden recipes" };
  }
}

/**
 * プロジェクトに関連付けられたレシピの一覧を取得します（CORS回避のためサーバーサイドでフェッチします）。
 * @param recipeNamespaces レシピのネームスペース配列
 * @param projectSlug プロジェクトのスラッグ
 * @param locale 言語ロケール
 */
export async function getProjectRecipesAction(
  recipeNamespaces: string[] | null | undefined,
  projectSlug: string,
  locale: string
) {
  try {
    const { db, project } = await authorizeProject(projectSlug);
    const cdnUrl = process.env.NEXT_PUBLIC_RECIPE_CDN_URL || "https://recipe.modparks.pitan76.net";
    const nsList = recipeNamespaces && recipeNamespaces.length > 0 ? recipeNamespaces : [projectSlug];

    const [lists, customNames] = await Promise.all([
      fetchRecipeLists(cdnUrl, nsList, locale),
      getCustomRecipeNames(project.id),
    ]);

    const recipes = toRecipeItems(cdnUrl, lists).map((r) => {
      const customName = customNames.get(r.id);
      return {
        ...r,
        originalName: r.name,
        name: customName || r.name,
      };
    });

    return { success: true, recipes };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to fetch recipes" };
  }
}

/**
 * レシピの表示名を上書き設定（またはクリア）します。
 * @param slug プロジェクトのスラッグ
 * @param recipeId 完全修飾レシピID
 * @param customName 上書きする名前（空なら上書き削除）
 */
export async function setRecipeCustomNameAction(slug: string, recipeId: string, customName: string) {
  if (!recipeId) return { error: "Recipe id is required" };

  try {
    const { db, session, project } = await authorizeProject(slug);

    const trimmed = customName.trim();
    if (trimmed) {
      await db
        .insert(projectRecipeNames)
        .values({
          projectId: project.id,
          recipeId,
          customName: trimmed,
          updatedBy: session.user.id,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [projectRecipeNames.projectId, projectRecipeNames.recipeId],
          set: {
            customName: trimmed,
            updatedBy: session.user.id,
            updatedAt: new Date(),
          },
        })
        .run();
    } else {
      await db
        .delete(projectRecipeNames)
        .where(
          and(
            eq(projectRecipeNames.projectId, project.id),
            eq(projectRecipeNames.recipeId, recipeId)
          )
        )
        .run();
    }

    revalidatePath(`/projects/${slug}`);
    return { success: true, customName: trimmed || null };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to update recipe name" };
  }
}
