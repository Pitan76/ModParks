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

  const entries = Object.entries(byNs);

  // 取り込みセッションを ns ごとに開く。分割送信全体を1トランザクションとして扱い、
  // バージョン更新とインデックス書き込みを最後の commit で1回にまとめる。
  // セッションを開けなかった ns はセッション無し（従来動作）にフォールバックする。
  const sessions = new Map<string, string>();
  for (const [ns] of entries) {
    const session = await beginSession(cdnUrl, ns, headers);
    if (session) sessions.set(ns, session);
  }

  let uploaded = 0;
  const postBulk = async (ns: string, part: Partial<NsBucket>, count: number) => {
    const session = sessions.get(ns);
    const url = `${cdnUrl}/api/${ns}/bulk${session ? `?session=${encodeURIComponent(session)}` : ""}`;
    try {
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(part) });
      if (res.ok) uploaded += count;
      else console.warn(`CDN bulk upload failed for ${ns}: ${res.status} ${res.statusText}`);
    } catch (e) {
      console.warn(`CDN bulk upload error for ${ns}:`, e);
    }
  };

  // テクスチャは base64 で嵩むため件数とバイト数の両方で分割。JSON 系は件数だけ
  const phase = async (
    pick: (b: NsBucket) => Record<string, string>,
    wrap: (c: Record<string, string>) => Partial<NsBucket>,
    maxCount: number,
    maxBytes?: number
  ) => {
    for (const [ns, bucket] of entries) {
      for (const c of chunkRecord(pick(bucket), maxCount, maxBytes)) {
        await postBulk(ns, wrap(c), Object.keys(c).length);
      }
    }
  };

  try {
    // レシピが先に入るとテクスチャ未着の透明アイコンが焼き付く。依存される側から送る。
    // 名前空間をまたぐ参照（mod のレシピが minecraft: を参照）があるため、
    // ns ごとではなく全 ns を通したフェーズ単位で進める
    await phase((b) => b.textures, (c) => ({ textures: c }), 80, 6_000_000);
    await phase((b) => b.models, (c) => ({ models: c }), 200);
    await phase((b) => b.tags, (c) => ({ tags: c }), 200);
    await phase((b) => b.recipes, (c) => ({ recipes: c }), 200);

    for (const [ns, session] of sessions) await endSession(cdnUrl, ns, session, "commit", headers);
  } catch (e) {
    // 途中失敗時はセッションを破棄し、壊れた中間状態を公開しない
    for (const [ns, session] of sessions) await endSession(cdnUrl, ns, session, "abort", headers);
    throw e;
  }

  return uploaded;
}

/** 取り込みセッションを開始し、セッションIDを返す（失敗時は null でフォールバック）。 */
async function beginSession(
  cdnUrl: string,
  ns: string,
  headers: Record<string, string>
): Promise<string | null> {
  try {
    const res = await fetch(`${cdnUrl}/api/${ns}/ingest/begin`, { method: "POST", headers });
    if (!res.ok) return null;
    const body = (await res.json()) as { session?: string };
    return body.session ?? null;
  } catch {
    return null;
  }
}

/** 取り込みセッションを確定または破棄する。 */
async function endSession(
  cdnUrl: string,
  ns: string,
  session: string,
  action: "commit" | "abort",
  headers: Record<string, string>
): Promise<void> {
  try {
    await fetch(`${cdnUrl}/api/${ns}/ingest/${action}?session=${encodeURIComponent(session)}`, {
      method: "POST",
      headers,
    });
  } catch (e) {
    console.warn(`CDN ingest ${action} failed for ${ns}:`, e);
  }
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

  const entries = Object.entries(byNs);
  const phase = async (
    pick: (b: NsBucket) => Record<string, string>,
    key: (ns: string, p: string) => string,
    type: string,
    body: (v: string) => ArrayBuffer | string = (v) => v
  ) => {
    for (const [ns, bucket] of entries) {
      for (const [p, v] of Object.entries(pick(bucket))) await write(key(ns, p), body(v), type);
    }
  };

  // uploadViaCdn と同じ理由で、依存される側から書き、レシピを最後にする
  await phase((b) => b.textures, (ns, p) => `assets/${ns}/textures/${p}`, "image/png", base64ToBytes);
  await phase((b) => b.models, (ns, p) => `assets/${ns}/models/${p}.json`, "application/json");
  await phase((b) => b.tags, (ns, p) => `data/${ns}/tags/${p}.json`, "application/json");
  await phase((b) => b.recipes, (ns, id) => `data/${ns}/recipe/${id}.json`, "application/json");
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

  let idx: { recipes?: unknown; ids?: unknown };
  try {
    idx = JSON.parse(await obj.text());
  } catch {
    return [];
  }
  if (Array.isArray(idx.recipes)) return idx.recipes as RecipeSummary[];
  // 旧形式: ID のみの配列だった頃のインデックスからの移行
  if (Array.isArray(idx.ids)) return idx.ids.map((i: string) => ({ id: i, result: i, type: "" }));
  return [];
}
