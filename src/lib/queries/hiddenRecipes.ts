import { getDatabase } from "@/lib/db";
import { projectHiddenRecipes } from "@/db/schema";
import { eq } from "drizzle-orm";

/** 公開ページ・編集画面の双方で使う: プロジェクトで非表示にされているレシピIDを取得する */
export async function getHiddenRecipeIds(projectId: string): Promise<Set<string>> {
  const db = await getDatabase();
  const rows = await db
    .select({ recipeId: projectHiddenRecipes.recipeId })
    .from(projectHiddenRecipes)
    .where(eq(projectHiddenRecipes.projectId, projectId))
    .all();

  return new Set(rows.map((r) => r.recipeId));
}
