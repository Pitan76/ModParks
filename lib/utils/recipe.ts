import JSZip from "jszip";
import { uploadToR2 } from "@/lib/r2";

function isCraftingType(type: unknown): boolean {
  if (typeof type !== 'string') return false;
  const t = type.replace(/^minecraft:/, '');
  return t === 'crafting_shaped' || t === 'crafting_shapeless';
}

function resultItemOf(data: any): string | null {
  const r = data?.result;
  if (!r) return null;
  const id = typeof r === 'string' ? r : (r.id || r.item || null);
  if (!id || typeof id !== 'string') return null;
  return id.includes(':') ? id : `minecraft:${id}`;
}

export async function extractAndUploadRecipes(
  arrayBuffer: ArrayBuffer,
  cdnUrl: string,
  cdnSecret: string | undefined,
  useCdnApi: boolean,
  R2: any
) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const allPaths = Object.keys(zip.files).filter(p => !zip.files[p].dir);

  // MC 1.21.2+ ではフォルダ名が単数形 (recipe / tag) になったため両対応する
  const recipes = allPaths.filter(p => p.match(/^data\/[^\/]+\/recipes?\/.*\.json$/));
  const tags = allPaths.filter(p => p.match(/^data\/[^\/]+\/tags?\/.*\.json$/));
  const textures = allPaths.filter(p => p.match(/^assets\/[^\/]+\/textures\/(item|block)\/.*\.png$/));

  let uploadedCount = 0;
  const newRecipes: any[] = [];

  /**
   * 抽出ファイルを送出する。
   * useCdnApi=true: レシピCDNのAPIへ PUT（CDNが自前のストレージに保存・描画する）。
   * useCdnApi=false: アプリの R2 バケットへ直接書き込む（開発/フォールバック）。
   */
  const uploadExtractedFile = async (
    endpoint: string,
    r2Path: string,
    content: ArrayBuffer | string,
    contentType: string
  ) => {
    if (useCdnApi) {
      try {
        const headers: Record<string, string> = { "Content-Type": contentType };
        if (cdnSecret) headers["Authorization"] = `Bearer ${cdnSecret}`;
        const res = await fetch(`${cdnUrl}${endpoint}`, { method: "PUT", headers, body: content });
        if (res.ok) {
          uploadedCount++;
        } else {
          console.warn(`CDN upload failed for ${endpoint}: ${res.status} ${res.statusText}`);
        }
      } catch (e) {
        console.warn(`CDN upload error for ${endpoint}:`, e);
      }
    } else {
      try {
        await uploadToR2(R2, r2Path, content, contentType);
        uploadedCount++;
      } catch (e) {
        console.warn(`Direct R2 upload failed for ${r2Path}:`, e);
      }
    }
  };

  // Upload Recipes
  for (const path of recipes) {
    const match = path.match(/^data\/([^\/]+)\/recipes?\/(.+)\.json$/);
    if (match) {
      const namespace = match[1];
      const id = match[2];
      const content = await zip.files[path].async("string");

      try {
        const data = JSON.parse(content);
        if (isCraftingType(data?.type)) {
          newRecipes.push({
            id: `${namespace}:${id}`,
            result: resultItemOf(data),
            type: String(data.type).replace(/^minecraft:/, '')
          });
        }
      } catch (e) {}

      await uploadExtractedFile(`/api/${namespace}/recipe/${id}`, path, content, "application/json");
    }
  }

  // Upload Tags
  for (const path of tags) {
    const match = path.match(/^data\/([^\/]+)\/tags?\/(.+)\.json$/);
    if (match) {
      const namespace = match[1];
      const tagPath = match[2];
      const content = await zip.files[path].async("string");
      await uploadExtractedFile(`/api/${namespace}/tag/${tagPath}`, path, content, "application/json");
    }
  }

  // Upload Textures
  for (const path of textures) {
    const match = path.match(/^assets\/([^\/]+)\/textures\/(.+)\.png$/);
    if (match) {
      const namespace = match[1];
      const texPath = `${match[2]}.png`;
      const content = await zip.files[path].async("arraybuffer");
      await uploadExtractedFile(`/api/${namespace}/texture/${texPath}`, path, content, "image/png");
    }
  }

  // R2 直書きモードのときだけ index/recipes.json を更新する。
  // CDN API モードでは CDN 側が自前でインデックスを管理する。
  if (!useCdnApi && newRecipes.length > 0 && R2) {
    try {
      const indexObj = await R2.get('index/recipes.json');
      let idx: any = {};
      if (indexObj) {
        const text = await indexObj.text();
        try { idx = JSON.parse(text); } catch(e) {}
      }
      
      let existingRecipes: any[] = Array.isArray(idx.recipes) ? idx.recipes : [];
      if (!Array.isArray(existingRecipes) && Array.isArray(idx.ids)) {
        existingRecipes = idx.ids.map((i: string) => ({ id: i, result: i }));
      }
      
      const newIds = new Set(newRecipes.map(r => r.id));
      existingRecipes = existingRecipes.filter(r => !newIds.has(r.id));
      existingRecipes.push(...newRecipes);
      existingRecipes.sort((a, b) => a.id.localeCompare(b.id));

      const newIndex = JSON.stringify({
        count: existingRecipes.length,
        generatedAt: new Date().toISOString(),
        recipes: existingRecipes
      });

      await uploadToR2(R2, 'index/recipes.json', newIndex, "application/json");
    } catch(e) {
      console.warn("Failed to update index/recipes.json", e);
    }
  }

  return uploadedCount;
}
