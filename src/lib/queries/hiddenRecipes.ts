import { projectHiddenRecipes } from "@modparks/core/db/schema";
import type { Database } from "@modparks/core/db/client";
import { eq } from "drizzle-orm";

/** 公開ページ・編集画面の双方で使う: プロジェクトで非表示にされているレシピIDを取得する */
export async function getHiddenRecipeIds(db: Database, projectId: string): Promise<Set<string>> {
  const rows = await db
    .select({ recipeId: projectHiddenRecipes.recipeId })
    .from(projectHiddenRecipes)
    .where(eq(projectHiddenRecipes.projectId, projectId))
    .all();

  return new Set(rows.map((r) => r.recipeId));
}
