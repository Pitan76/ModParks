"use client";

import { analyzeJar } from "@/lib/utils/jarExtractor";
import { extractRecipesFromVersion, uploadClientExtractedRecipes } from "@/lib/actions/versionRecipe";

export type RecipeExtractionResult = { ok: true } | { ok: false; message: string };

/**
 * 登録済みバージョンからレシピを抽出する。
 *
 * まずブラウザ側で JAR を解析して結果だけ送る（jszip をサーバに載せず、
 * 大きなファイルを往復させないため）。ブラウザ側が失敗した場合に限り、
 * サーバ側の抽出へ切り替える。
 *
 * @param versionId 抽出対象のバージョンID
 * @param slug プロジェクトの slug
 * @param file アップロードした JAR/ZIP
 */
export async function runRecipeExtraction(
  versionId: string,
  slug: string,
  file: File,
): Promise<RecipeExtractionResult> {
  let clientError = "";

  try {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(file);
    const { byNs } = await analyzeJar(zip);

    const uploadRes = await uploadClientExtractedRecipes(versionId, slug, byNs);
    if (uploadRes && "success" in uploadRes && uploadRes.success) return { ok: true };
    if (uploadRes && "error" in uploadRes && uploadRes.error) clientError = uploadRes.error;
  } catch (err) {
    console.warn("Client extraction failed, falling back to server side:", err);
    clientError = err instanceof Error ? err.message : "Client extraction error";
  }

  const extractRes = await extractRecipesFromVersion(versionId, slug);
  if ("error" in extractRes && extractRes.error) {
    return { ok: false, message: `${clientError} -> ${extractRes.error}` };
  }
  return { ok: true };
}
