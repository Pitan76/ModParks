"use server";

import { getAuthenticatedDb, assertProjectAccess } from "@/lib/auth-helpers";
import { projects, projectHiddenRecipes } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/** 1文に載せるレシピIDの数。D1 のバインド変数上限に当たらないよう分割する。 */
const CHUNK_SIZE = 90;

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

  const project = await db.select().from(projects).where(eq(projects.slug, slug)).get();
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

    for (let i = 0; i < recipeIds.length; i += CHUNK_SIZE) {
      const chunk = recipeIds.slice(i, i + CHUNK_SIZE);
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
