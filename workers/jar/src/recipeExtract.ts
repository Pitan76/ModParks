import JSZip from "jszip";
import { assertEntryCount, ExtractBudget, uncompressedSize } from "./limits";
import { isSharedNamespace } from "../../../src/lib/data/sharedNamespaces";

/** ネームスペース単位でまとめた抽出結果 */
export interface NsBucket {
  recipes: Record<string, string>;
  tags: Record<string, string>;
  /** base64 エンコード済み PNG */
  textures: Record<string, string>;
  models: Record<string, string>;
  /** ロケール名（ja_jp など）をキーとした言語ファイル。アイテム名の表示に使う */
  langs: Record<string, string>;
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
// 言語ファイル。ロケールを絞らず jar にあるものを全て取り込むため、対応言語を
// 増やすときにこちらを変更する必要がない。
const LANG_PATH = /^assets\/([^/]+)\/lang\/([a-z]{2,8}(?:_[a-z0-9]{2,8})?)\.json$/;

/** レシピ JSON のうち、インデックス生成に使う部分だけの最小形 */
interface RecipeJson {
  type?: unknown;
  result?: unknown;
}

const isCraftingType = (type: unknown): boolean => {
  if (typeof type !== "string") return false;
  const t = type.replace(/^minecraft:/, "");
  return t === "crafting_shaped" || t === "crafting_shapeless";
};

function resultItemOf(data: RecipeJson): string | null {
  const r = data.result;
  if (!r) return null;
  const id = typeof r === "string" ? r : (r as { id?: string; item?: string }).id ?? (r as { item?: string }).item;
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

/**
 * JAR 内のレシピ・タグ・テクスチャ・モデルをネームスペース別に集める。
 *
 * 抽出量に予算を設けている。全エントリを無条件に展開すると、
 * zip bomb や極端に大きい mod で Isolate のメモリを使い切るため。
 * 予算を超えた分は取りこぼすが、解析が落ちるより部分的な結果の方が有用。
 */
/**
 * バジェット制限内でファイルの中身を展開します。
 *
 * 事前にサイズが取得できない場合は、展開後に実サイズをバジェットから差し引きます。
 * バジェットを超えた場合は null を返します。
 */
async function extractWithBudget(
  zip: JSZip,
  path: string,
  budget: ExtractBudget,
  asBinary: boolean
): Promise<string | Uint8Array | null> {
  const size = uncompressedSize(zip.files[path]);
  if (size !== undefined) {
    if (!budget.allow(size)) return null;
    return asBinary
      ? new Uint8Array(await zip.files[path].async("arraybuffer"))
      : await zip.files[path].async("string");
  }
  if (asBinary) {
    const bytes = new Uint8Array(await zip.files[path].async("arraybuffer"));
    if (!budget.allow(Math.ceil(bytes.length * 1.33))) return null;
    return bytes;
  }
  const content = await zip.files[path].async("string");
  if (!budget.allow(content.length)) return null;
  return content;
}

/**
 * 1つのファイルをマッチングし、バジェット範囲内であればネームスペース別に振り分けます。
 */
async function processPath(
  zip: JSZip,
  path: string,
  budget: ExtractBudget,
  byNs: Record<string, NsBucket>,
  namespaces: Set<string>,
  craftingRecipes: RecipeSummary[],
  ensureNs: (ns: string) => NsBucket
): Promise<void> {
  let m: RegExpMatchArray | null;
  if ((m = path.match(RECIPE_PATH))) {
    const [, ns, id] = m;
    // 共有ネームスペースのレシピは後段で捨てるため、索引にも「このmodのNS」にも載せない。
    // ここで載せると、mod が同梱した data/minecraft/recipes が投稿者のNSとして記録され、
    // プロジェクトの一覧にバニラのレシピが丸ごと並ぶ。
    if (isSharedNamespace(ns)) return;
    const content = await extractWithBudget(zip, path, budget, false);
    if (content === null) return;
    namespaces.add(ns);
    ensureNs(ns).recipes[id] = content as string;
    collectCrafting(craftingRecipes, ns, id, content as string);
  } else if ((m = path.match(TAG_PATH))) {
    const content = await extractWithBudget(zip, path, budget, false);
    if (content !== null) ensureNs(m[1]).tags[m[2]] = content as string;
  } else if ((m = path.match(TEXTURE_PATH))) {
    const bytes = await extractWithBudget(zip, path, budget, true);
    if (bytes !== null) ensureNs(m[1]).textures[`${m[2]}.png`] = bytesToBase64(bytes as Uint8Array);
  } else if ((m = path.match(MODEL_PATH))) {
    const content = await extractWithBudget(zip, path, budget, false);
    if (content !== null) ensureNs(m[1]).models[m[2]] = content as string;
  } else if ((m = path.match(LANG_PATH))) {
    const content = await extractWithBudget(zip, path, budget, false);
    if (content !== null) ensureNs(m[1]).langs[m[2]] = content as string;
  }
}

/**
 * JAR 内のレシピ・タグ・テクスチャ・モデルをネームスペース別に集める。
 *
 * 抽出量に予算を設けている。全エントリを無条件に展開すると、
 * zip bomb や極端に大きい mod で Isolate のメモリを使い切るため。
 * 予算を超えた分は取りこぼすが、解析が落ちるより部分的な結果の方が有用。
 */
export async function extractRecipes(arrayBuffer: ArrayBuffer): Promise<ExtractedRecipes> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const paths = Object.keys(zip.files).filter((p) => !zip.files[p].dir);
  assertEntryCount(paths.length);

  const budget = new ExtractBudget();
  const byNs: Record<string, NsBucket> = {};
  const ensureNs = (ns: string): NsBucket =>
    (byNs[ns] ||= { recipes: {}, tags: {}, textures: {}, models: {}, langs: {} });

  const namespaces = new Set<string>();
  const craftingRecipes: RecipeSummary[] = [];

  for (const path of paths) {
    if (budget.exhausted) break;
    await processPath(zip, path, budget, byNs, namespaces, craftingRecipes, ensureNs);
  }

  for (const ns of Object.keys(byNs)) {
    if (isSharedNamespace(ns)) byNs[ns] = { recipes: {}, tags: byNs[ns].tags, textures: {}, models: {}, langs: {} };
  }

  return { byNs, namespaces: [...namespaces], craftingRecipes };
}

/** クラフティングレシピならインデックス用の要約を積む。壊れた JSON は黙って飛ばす。 */
function collectCrafting(out: RecipeSummary[], ns: string, id: string, content: string): void {
  let data: RecipeJson;
  try {
    data = JSON.parse(content) as RecipeJson;
  } catch {
    return;
  }
  if (!isCraftingType(data.type)) return;
  out.push({
    id: `${ns}:${id}`,
    result: resultItemOf(data),
    type: String(data.type).replace(/^minecraft:/, ""),
  });
}
