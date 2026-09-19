import { projectRecipeNames } from "@modparks/core/db/schema";
import type { Database } from "@modparks/core/db/client";
import { eq } from "drizzle-orm";

/**
 * プロジェクトで上書きされているレシピ名（IDとカスタム名のマップ）を取得する
 */
export async function getCustomRecipeNames(db: Database, projectId: string): Promise<Map<string, string>> {
  const rows = await db
    .select({
      recipeId: projectRecipeNames.recipeId,
      customName: projectRecipeNames.customName,
    })
    .from(projectRecipeNames)
    .where(eq(projectRecipeNames.projectId, projectId))
    .all();

  return new Map(rows.map((r) => [r.recipeId, r.customName]));
}
