"use server";

import { getAuthenticatedDb, assertProjectAccess } from "@/lib/auth-helpers";
import { versions, projects } from "@/db/schema";
import { getR2KeyFromUrl } from "@/lib/r2";
import { isAllowedExternalUrl } from "@/lib/validations";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * JARファイル内のクラフティングレシピを抽出し、CDN/R2にアップロードして
 * プロジェクトに関連付けられたレシピデータを作成する Server Action。
 */
export const extractRecipesFromVersion = async (versionId: string, projectSlug: string) => {
  const { db, session } = await getAuthenticatedDb();

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.slug, projectSlug))
    .get();

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
  let arrayBuffer: ArrayBuffer;
  let R2 = null;

  try {
    const { getR2Bucket } = await import("@/lib/r2");
    R2 = await getR2Bucket();

    if (r2Key) {
      const object = await R2.get(r2Key);
      if (!object) return { error: "File not found in R2." };
      arrayBuffer = await object.arrayBuffer();
    } else {
      if (!isAllowedExternalUrl(version.fileUrl)) {
        return { error: "Cannot extract recipes from this external URL domain." };
      }
      const res = await fetch(version.fileUrl);
      if (!res.ok) return { error: `Failed to download file from external URL: ${res.statusText}` };
      arrayBuffer = await res.arrayBuffer();
    }

    const cdnUrl = process.env.NEXT_PUBLIC_RECIPE_CDN_URL || "https://recipe.modparks.pitan76.net";
    let cdnSecret = process.env.RECIPE_CDN_SECRET;
    
    if (!cdnSecret) {
      try {
        if (process.env.NODE_ENV !== "development") {
          const { getCloudflareContext } = await import("@opennextjs/cloudflare");
          const { env } = await getCloudflareContext({ async: true });
          if ((env as any).RECIPE_CDN_SECRET) {
            cdnSecret = (env as any).RECIPE_CDN_SECRET;
          }
        }
      } catch (e) {}
    }

    const useCdnApi = process.env.USE_RECIPE_CDN_API === "true";
    const { extractAndUploadRecipes } = await import("@/lib/utils/recipe");

    const { count: extractedCount, namespaces } = await extractAndUploadRecipes(
      arrayBuffer,
      cdnUrl,
      cdnSecret,
      useCdnApi,
      R2
    );

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
