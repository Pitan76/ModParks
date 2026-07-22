import JSZip from "jszip";

/** ネームスペース単位でまとめた抽出結果 */
export interface NsBucket {
  recipes: Record<string, string>;
  tags: Record<string, string>;
  /** base64 エンコード済み PNG */
  textures: Record<string, string>;
  models: Record<string, string>;
}

/** index/recipes.json に載せるクラフティングレシピの要約 */
export interface RecipeSummary {
  id: string;
  result: string | null;
  type: string;
}

export interface ExtractedRecipes {
  byNs: Record<string, NsBucket>;
  namespaces: string[];
  craftingRecipes: RecipeSummary[];
}

// MC 1.21.2+ でフォルダ名が単数形 (recipe / tag) になったため両対応する
const RECIPE_PATH = /^data\/([^/]+)\/recipes?\/(.+)\.json$/;
const TAG_PATH = /^data\/([^/]+)\/tags?\/(.+)\.json$/;
const TEXTURE_PATH = /^assets\/([^/]+)\/textures\/((?:item|block)\/.+)\.png$/;
// モデルJSON は、テクスチャ名 != アイテムID のとき CDN が parent/textures
// チェインを辿って実テクスチャを解決するために必要。
const MODEL_PATH = /^assets\/([^/]+)\/models\/((?:item|block)\/.+)\.json$/;

const isCraftingType = (type: unknown): boolean => {
  if (typeof type !== "string") return false;
  const t = type.replace(/^minecraft:/, "");
  return t === "crafting_shaped" || t === "crafting_shapeless";
};

function resultItemOf(data: any): string | null {
  const r = data?.result;
  if (!r) return null;
  const id = typeof r === "string" ? r : r.id || r.item || null;
  if (!id || typeof id !== "string") return null;
  return id.includes(":") ? id : `minecraft:${id}`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000; // fromCharCode の引数個数上限を避ける
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** JAR 内のレシピ・タグ・テクスチャ・モデルをネームスペース別に集める */
export async function extractRecipes(arrayBuffer: ArrayBuffer): Promise<ExtractedRecipes> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const paths = Object.keys(zip.files).filter((p) => !zip.files[p].dir);

  const byNs: Record<string, NsBucket> = {};
  const ensureNs = (ns: string): NsBucket =>
    (byNs[ns] ||= { recipes: {}, tags: {}, textures: {}, models: {} });

  const namespaces = new Set<string>();
  const craftingRecipes: RecipeSummary[] = [];

  for (const path of paths) {
    const recipe = path.match(RECIPE_PATH);
    if (recipe) {
      const [, ns, id] = recipe;
      namespaces.add(ns);
      const content = await zip.files[path].async("string");
      ensureNs(ns).recipes[id] = content;
      collectCrafting(craftingRecipes, ns, id, content);
      continue;
    }

    const tag = path.match(TAG_PATH);
    if (tag) {
      ensureNs(tag[1]).tags[tag[2]] = await zip.files[path].async("string");
      continue;
    }

    const texture = path.match(TEXTURE_PATH);
    if (texture) {
      const bytes = new Uint8Array(await zip.files[path].async("arraybuffer"));
      ensureNs(texture[1]).textures[`${texture[2]}.png`] = bytesToBase64(bytes);
      continue;
    }

    const model = path.match(MODEL_PATH);
    if (model) ensureNs(model[1]).models[model[2]] = await zip.files[path].async("string");
  }

  return { byNs, namespaces: [...namespaces], craftingRecipes };
}

/** クラフティングレシピならインデックス用の要約を積む。壊れた JSON は黙って飛ばす。 */
function collectCrafting(out: RecipeSummary[], ns: string, id: string, content: string): void {
  let data: any;
  try {
    data = JSON.parse(content);
  } catch {
    return;
  }
  if (!isCraftingType(data?.type)) return;
  out.push({
    id: `${ns}:${id}`,
    result: resultItemOf(data),
    type: String(data.type).replace(/^minecraft:/, ""),
  });
}
