/**
 * プロジェクトページでのレシピの見せ方を持つテーブル群。
 * レシピの実体は jar 由来でレシピCDN（mp-recipe）が持つため、ここには
 * 「出さない」「名前を差し替える」といった表示上の判断だけを置く。
 */
import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";
import { projects } from "./projects";

/**
 * プロジェクトページで非表示にするレシピ。
 *
 * 中間生成物や見せたくないレシピが jar に含まれていても、再抽出のたびに復活しないようにするための表。
 */
export const projectHiddenRecipes = sqliteTable(
  "project_hidden_recipes",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** 完全修飾レシピID（例 "mymod:widget"）。CDN の索引が返す id と同じ表記 */
    recipeId: text("recipe_id").notNull(),
    hiddenBy: text("hidden_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.recipeId] }),
    index("project_hidden_recipes_project_idx").on(t.projectId),
  ]
);

/**
 * プロジェクト側でレシピ名を上書きして変更するテーブル。
 */
export const projectRecipeNames = sqliteTable(
  "project_recipe_names",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** 完全修飾レシピID（例 "mymod:widget"）。CDN の索引が返す id と同じ表記 */
    recipeId: text("recipe_id").notNull(),
    /** プロジェクト側で上書きしたレシピ名 */
    customName: text("custom_name").notNull(),
    updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.recipeId] }),
    index("project_recipe_names_project_idx").on(t.projectId),
  ]
);

export type ProjectHiddenRecipe = typeof projectHiddenRecipes.$inferSelect;
export type ProjectRecipeName = typeof projectRecipeNames.$inferSelect;
