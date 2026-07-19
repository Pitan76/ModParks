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
  cdnUrl: string, // parameter kept for compatibility
  cdnSecret: string | undefined, // parameter kept for compatibility
  useCdnApi: boolean, // parameter kept for compatibility
  R2: any
) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const allPaths = Object.keys(zip.files).filter(p => !zip.files[p].dir);
  
  const recipes = allPaths.filter(p => p.match(/^data\/[^\/]+\/recipes\/.*\.json$/));
  const tags = allPaths.filter(p => p.match(/^data\/[^\/]+\/tags\/.*\.json$/));
  const textures = allPaths.filter(p => p.match(/^assets\/[^\/]+\/textures\/(item|block)\/.*\.png$/));

  let uploadedCount = 0;
  const newRecipes: any[] = [];

  // Upload Recipes
  for (const path of recipes) {
    const match = path.match(/^data\/([^\/]+)\/recipes\/(.+)\.json$/);
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

      try {
        await uploadToR2(R2, path, content, "application/json");
        uploadedCount++;
      } catch (e) {
        console.warn(`Direct R2 upload failed for ${path}:`, e);
      }
    }
  }

  // Upload Tags
  for (const path of tags) {
    const match = path.match(/^data\/([^\/]+)\/tags\/(.+)\.json$/);
    if (match) {
      const content = await zip.files[path].async("string");
      try {
        await uploadToR2(R2, path, content, "application/json");
        uploadedCount++;
      } catch (e) {
        console.warn(`Direct R2 upload failed for ${path}:`, e);
      }
    }
  }

  // Upload Textures
  for (const path of textures) {
    const match = path.match(/^assets\/([^\/]+)\/textures\/(.+)\.png$/);
    if (match) {
      const content = await zip.files[path].async("arraybuffer");
      try {
        await uploadToR2(R2, path, content, "image/png");
        uploadedCount++;
      } catch (e) {
        console.warn(`Direct R2 upload failed for ${path}:`, e);
      }
    }
  }
  
  // Update index/recipes.json if any recipes were extracted
  if (newRecipes.length > 0 && R2) {
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
