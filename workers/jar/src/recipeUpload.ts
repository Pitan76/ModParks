import type { NsBucket, RecipeSummary } from "./recipeExtract";

/** エントリ数と（任意で）バイト数を上限にレコードを分割する */
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

/**
 * CDN の bulk API へ送出する。
 *
 * 1ファイル1リクエストにすると Workers のサブリクエスト上限に達し、後段
 * （タグ/テクスチャ/モデル）が丸ごと落ちるため、まとめて数回の POST にする。
 */
export async function uploadViaCdn(
  byNs: Record<string, NsBucket>,
  cdnUrl: string,
  cdnSecret: string | undefined
): Promise<number> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cdnSecret) headers["Authorization"] = `Bearer ${cdnSecret}`;

  let uploaded = 0;
  const postBulk = async (ns: string, part: Partial<NsBucket>, count: number) => {
    try {
      const res = await fetch(`${cdnUrl}/api/${ns}/bulk`, {
        method: "POST",
        headers,
        body: JSON.stringify(part),
      });
      if (res.ok) uploaded += count;
      else console.warn(`CDN bulk upload failed for ${ns}: ${res.status} ${res.statusText}`);
    } catch (e) {
      console.warn(`CDN bulk upload error for ${ns}:`, e);
    }
  };

  for (const [ns, bucket] of Object.entries(byNs)) {
    // JSON 系（レシピ/タグ/モデル）は小さいので件数だけで分割
    for (const c of chunkRecord(bucket.recipes, 200)) await postBulk(ns, { recipes: c }, Object.keys(c).length);
    for (const c of chunkRecord(bucket.tags, 200)) await postBulk(ns, { tags: c }, Object.keys(c).length);
    for (const c of chunkRecord(bucket.models, 200)) await postBulk(ns, { models: c }, Object.keys(c).length);
    // テクスチャは base64 で嵩むため件数とバイト数の両方で分割
    for (const c of chunkRecord(bucket.textures, 80, 6_000_000)) {
      await postBulk(ns, { textures: c }, Object.keys(c).length);
    }
  }
  return uploaded;
}

const put = (r2: R2Bucket, key: string, body: ArrayBuffer | string, contentType: string) =>
  r2.put(key, body, { httpMetadata: { contentType } });

function base64ToBytes(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/** 開発/フォールバック: バインディング経由で R2 へ直接書き込む（サブリクエスト上限なし） */
export async function uploadDirectToR2(
  byNs: Record<string, NsBucket>,
  r2: R2Bucket
): Promise<number> {
  let uploaded = 0;
  const write = async (key: string, body: ArrayBuffer | string, type: string) => {
    try {
      await put(r2, key, body, type);
      uploaded++;
    } catch (e) {
      console.warn(`Direct R2 upload failed for ${key}:`, e);
    }
  };

  for (const [ns, bucket] of Object.entries(byNs)) {
    for (const [id, c] of Object.entries(bucket.recipes)) {
      await write(`data/${ns}/recipe/${id}.json`, c, "application/json");
    }
    for (const [p, c] of Object.entries(bucket.tags)) {
      await write(`data/${ns}/tags/${p}.json`, c, "application/json");
    }
    for (const [p, b64] of Object.entries(bucket.textures)) {
      await write(`assets/${ns}/textures/${p}`, base64ToBytes(b64), "image/png");
    }
    for (const [p, c] of Object.entries(bucket.models)) {
      await write(`assets/${ns}/models/${p}.json`, c, "application/json");
    }
  }
  return uploaded;
}

/**
 * index/recipes.json を更新する。
 * R2 直書きモード専用。CDN API モードでは CDN 側が自前でインデックスを管理する。
 */
export async function updateRecipeIndex(r2: R2Bucket, added: RecipeSummary[]): Promise<void> {
  if (added.length === 0) return;

  const existing = await readIndex(r2);
  const addedIds = new Set(added.map((r) => r.id));
  const merged = existing.filter((r) => !addedIds.has(r.id)).concat(added);
  merged.sort((a, b) => a.id.localeCompare(b.id));

  const body = JSON.stringify({
    count: merged.length,
    generatedAt: new Date().toISOString(),
    recipes: merged,
  });
  await put(r2, "index/recipes.json", body, "application/json");
}

async function readIndex(r2: R2Bucket): Promise<RecipeSummary[]> {
  const obj = await r2.get("index/recipes.json");
  if (!obj) return [];

  let idx: any = {};
  try {
    idx = JSON.parse(await obj.text());
  } catch {
    return [];
  }
  if (Array.isArray(idx.recipes)) return idx.recipes;
  // 旧形式: ID のみの配列だった頃のインデックスからの移行
  if (Array.isArray(idx.ids)) return idx.ids.map((i: string) => ({ id: i, result: i, type: "" }));
  return [];
}
