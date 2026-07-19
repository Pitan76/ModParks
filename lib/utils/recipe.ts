import JSZip from "jszip";
import { uploadToR2 } from "@/lib/r2";

export async function extractAndUploadRecipes(
  arrayBuffer: ArrayBuffer,
  cdnUrl: string,
  cdnSecret: string | undefined,
  useCdnApi: boolean,
  R2: any
) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const allPaths = Object.keys(zip.files).filter(p => !zip.files[p].dir);
  
  const recipes = allPaths.filter(p => p.match(/^data\/[^\/]+\/recipes\/.*\.json$/));
  const tags = allPaths.filter(p => p.match(/^data\/[^\/]+\/tags\/.*\.json$/));
  const textures = allPaths.filter(p => p.match(/^assets\/[^\/]+\/textures\/(item|block)\/.*\.png$/));

  let uploadedCount = 0;

  // Helper to PUT to CDN or direct R2
  const uploadExtractedFile = async (endpoint: string, r2Path: string, content: ArrayBuffer | string, contentType: string) => {
    if (useCdnApi) {
      const url = `${cdnUrl}${endpoint}`;
      const headers: Record<string, string> = { "Content-Type": contentType };
      if (cdnSecret) headers["Authorization"] = `Bearer ${cdnSecret}`;
      
      const res = await fetch(url, { method: "PUT", headers, body: content });
      if (!res.ok) {
        console.warn(`CDN upload failed for ${url}: ${res.status} ${res.statusText}`);
      } else {
        uploadedCount++;
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
    const match = path.match(/^data\/([^\/]+)\/recipes\/(.+)\.json$/);
    if (match) {
      const namespace = match[1];
      const id = match[2];
      const content = await zip.files[path].async("string");
      await uploadExtractedFile(`/api/${namespace}/recipe/${id}`, path, content, "application/json");
    }
  }

  // Upload Tags
  for (const path of tags) {
    const match = path.match(/^data\/([^\/]+)\/tags\/(.+)\.json$/);
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
      const texPath = match[2] + ".png";
      const content = await zip.files[path].async("arraybuffer");
      await uploadExtractedFile(`/api/${namespace}/texture/${texPath}`, path, content, "image/png");
    }
  }
  
  return uploadedCount;
}
