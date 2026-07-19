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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000; // avoid arg-count limits on fromCharCode
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Split a record into chunks bounded by entry count and (optional) byte size. */
function chunkRecord(
  obj: Record<string, string>,
  maxCount: number,
  maxBytes = Infinity
): Record<string, string>[] {
  const chunks: Record<string, string>[] = [];
  let cur: Record<string, string> = {};
  let n = 0;
  let bytes = 0;
  for (const [k, v] of Object.entries(obj)) {
    if (n > 0 && (n >= maxCount || bytes + v.length > maxBytes)) {
      chunks.push(cur);
      cur = {};
      n = 0;
      bytes = 0;
    }
    cur[k] = v;
    n++;
    bytes += v.length;
  }
  if (n > 0) chunks.push(cur);
  return chunks;
}

type NsBucket = {
  recipes: Record<string, string>;
  tags: Record<string, string>;
  textures: Record<string, string>; // base64
  models: Record<string, string>;
};

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
  // モデルJSON（item/block）。テクスチャ名 != アイテムID のとき、CDN が
  // parent/textures チェインを辿って実テクスチャを解決するために必要。
  const models = allPaths.filter(p => p.match(/^assets\/[^\/]+\/models\/(item|block)\/.*\.json$/));

  // 抽出したレシピのネームスペース（表示フィルタ用にプロジェクトへ保存する）
  const namespaces = new Set<string>();
  // 送出対象をネームスペース単位でまとめる。CDN API モードでは 1 ファイル 1 fetch
  // だと Cloudflare Workers のサブリクエスト上限に達し、後段（タグ/テクスチャ/
  // モデル）が丸ごと落ちる。まとめてから数回の bulk POST で送る。
  const byNs: Record<string, NsBucket> = {};
  const ensureNs = (ns: string): NsBucket =>
    (byNs[ns] ||= { recipes: {}, tags: {}, textures: {}, models: {} });

  const newRecipes: any[] = [];

  // Collect Recipes
  for (const path of recipes) {
    const match = path.match(/^data\/([^\/]+)\/recipes?\/(.+)\.json$/);
    if (!match) continue;
    const namespace = match[1];
    const id = match[2];
    namespaces.add(namespace);
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

    ensureNs(namespace).recipes[id] = content;
  }

  // Collect Tags
  for (const path of tags) {
    const match = path.match(/^data\/([^\/]+)\/tags?\/(.+)\.json$/);
    if (!match) continue;
    const namespace = match[1];
    const tagPath = match[2];
    ensureNs(namespace).tags[tagPath] = await zip.files[path].async("string");
  }

  // Collect Textures (base64)
  for (const path of textures) {
    const match = path.match(/^assets\/([^\/]+)\/textures\/(.+)\.png$/);
    if (!match) continue;
    const namespace = match[1];
    const texPath = `${match[2]}.png`;
    const bytes = new Uint8Array(await zip.files[path].async("arraybuffer"));
    ensureNs(namespace).textures[texPath] = bytesToBase64(bytes);
  }

  // Collect Models
  for (const path of models) {
    const match = path.match(/^assets\/([^\/]+)\/models\/(.+)\.json$/);
    if (!match) continue;
    const namespace = match[1];
    const modelPath = match[2]; // 例: "item/aegu" / "block/alchemy_chest"
    ensureNs(namespace).models[modelPath] = await zip.files[path].async("string");
  }

  let uploadedCount = 0;

  if (useCdnApi) {
    // まとめて bulk POST（サブリクエスト数を大幅削減）。
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (cdnSecret) headers["Authorization"] = `Bearer ${cdnSecret}`;

    const postBulk = async (namespace: string, part: Partial<NsBucket>, count: number) => {
      try {
        const res = await fetch(`${cdnUrl}/api/${namespace}/bulk`, {
          method: "POST",
          headers,
          body: JSON.stringify(part),
        });
        if (res.ok) {
          uploadedCount += count;
        } else {
          console.warn(`CDN bulk upload failed for ${namespace}: ${res.status} ${res.statusText}`);
        }
      } catch (e) {
        console.warn(`CDN bulk upload error for ${namespace}:`, e);
      }
    };

    for (const [namespace, bucket] of Object.entries(byNs)) {
      // JSON 系（レシピ/タグ/モデル）は小さいので件数だけで分割。
      for (const chunk of chunkRecord(bucket.recipes, 200)) {
        await postBulk(namespace, { recipes: chunk }, Object.keys(chunk).length);
      }
      for (const chunk of chunkRecord(bucket.tags, 200)) {
        await postBulk(namespace, { tags: chunk }, Object.keys(chunk).length);
      }
      for (const chunk of chunkRecord(bucket.models, 200)) {
        await postBulk(namespace, { models: chunk }, Object.keys(chunk).length);
      }
      // テクスチャは base64 で嵩むため、件数とバイト数の両方で分割。
      for (const chunk of chunkRecord(bucket.textures, 80, 6_000_000)) {
        await postBulk(namespace, { textures: chunk }, Object.keys(chunk).length);
      }
    }
  } else {
    // 開発/フォールバック: アプリの R2 バケットへ直接書き込む（binding なので上限なし）。
    for (const [namespace, bucket] of Object.entries(byNs)) {
      for (const [id, content] of Object.entries(bucket.recipes)) {
        try {
          await uploadToR2(R2, `data/${namespace}/recipe/${id}.json`, content, "application/json");
          uploadedCount++;
        } catch (e) { console.warn(`Direct R2 recipe upload failed for ${id}:`, e); }
      }
      for (const [tagPath, content] of Object.entries(bucket.tags)) {
        try {
          await uploadToR2(R2, `data/${namespace}/tags/${tagPath}.json`, content, "application/json");
          uploadedCount++;
        } catch (e) { console.warn(`Direct R2 tag upload failed for ${tagPath}:`, e); }
      }
      for (const [texPath, b64] of Object.entries(bucket.textures)) {
        try {
          const bin = atob(b64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          await uploadToR2(R2, `assets/${namespace}/textures/${texPath}`, bytes.buffer, "image/png");
          uploadedCount++;
        } catch (e) { console.warn(`Direct R2 texture upload failed for ${texPath}:`, e); }
      }
      for (const [modelPath, content] of Object.entries(bucket.models)) {
        try {
          await uploadToR2(R2, `assets/${namespace}/models/${modelPath}.json`, content, "application/json");
          uploadedCount++;
        } catch (e) { console.warn(`Direct R2 model upload failed for ${modelPath}:`, e); }
      }
    }

    // R2 直書きモードのときだけ index/recipes.json を更新する。
    // CDN API モードでは CDN 側が自前でインデックスを管理する。
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
  }

  return { count: uploadedCount, namespaces: Array.from(namespaces) };
}
