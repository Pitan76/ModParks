"use server";

import { getAuthenticatedDb, assertProjectAccess } from "@/lib/auth-helpers";
import { versions, projects } from "@/db/schema";
import { getR2KeyFromUrl } from "@/lib/r2";
import { isAllowedExternalUrl } from "@/lib/validations";
import { extractRecipes, type JarSource } from "@/lib/services/jar";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { findProjectPostBySlug } from "@/lib/queries/post";

/**
 * JARファイル内のクラフティングレシピを抽出し、CDN/R2にアップロードして
 * プロジェクトに関連付けられたレシピデータを作成する Server Action。
 */
export const extractRecipesFromVersion = async (versionId: string, projectSlug: string) => {
  const { db, session } = await getAuthenticatedDb();

  const project = await findProjectPostBySlug(db, projectSlug);

  if (!project) return { error: "Project not found" };

  await assertProjectAccess(db, project, session);

  const version = await db
    .select()
    .from(versions)
    .where(and(eq(versions.id, versionId), eq(versions.projectId, project.id)))
    .get();

  if (!version) return { error: "Version not found" };
  if (!version.fileUrl) return { error: "No file URL associated with this version" };

  const r2Key = getR2KeyFromUrl(version.fileUrl);
  if (!r2Key && !isAllowedExternalUrl(version.fileUrl)) {
    return { error: "Cannot extract recipes from this external URL domain." };
  }

  // ファイルの取得も解析も modparks-jar Worker 側で行う（jszip を本体に載せないため）
  const source: JarSource = r2Key
    ? { kind: "r2", key: r2Key }
    : { kind: "url", url: version.fileUrl };

  try {
    const cdnUrl = process.env.NEXT_PUBLIC_RECIPE_CDN_URL || "https://recipe.modparks.pitan76.net";
    const useCdnApi = process.env.USE_RECIPE_CDN_API === "true";

    // 対象 MC バージョンは version レコードが正。JAR の依存宣言より、公開者の申告を優先する。
    const { count: extractedCount, namespaces } = await extractRecipes(source, cdnUrl, useCdnApi, {
      mcVersions: parseJsonArray(version.mcVersions),
      modVersion: version.versionNumber,
      loader: parseJsonArray(version.loaders)[0] ?? null,
    });

    if (namespaces.length > 0) {
      const existing = Array.isArray(project.recipeNamespaces) ? project.recipeNamespaces : [];
      const merged = Array.from(new Set([...existing, ...namespaces])).sort();
      if (merged.length !== existing.length) {
        await db.update(projects).set({ recipeNamespaces: merged }).where(eq(projects.id, project.id)).run();
      }
    }

    revalidatePath(`/projects/${projectSlug}`);
    revalidatePath(`/[locale]/projects/${projectSlug}`, "page");

    return { success: true, count: extractedCount };
  } catch (err: unknown) {
    console.error("Failed to extract recipes:", err);
    return { error: err instanceof Error ? err.message : "Failed to extract recipes" };
  }
};

/**
 * JSON文字列で保持している配列カラムを読み出す。
 * @param raw 保存されている値
 * @returns 文字列の配列。壊れていれば空配列
 */
const parseJsonArray = (raw: string): string[] => {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};
