import type JSZip from "jszip";
import { isSharedNamespace } from "@/lib/data/sharedNamespaces";

const RECIPE_PATH = /^data\/([^/]+)\/recipes?\/(.+)\.json$/;
const TAG_PATH = /^data\/([^/]+)\/tags?\/(.+)\.json$/;
const TEXTURE_PATH = /^assets\/([^/]+)\/textures\/((?:item|block)\/.+)\.png$/;
const MODEL_PATH = /^assets\/([^/]+)\/models\/((?:item|block)\/.+)\.json$/;
const LANG_PATH = /^assets\/([^/]+)\/lang\/([a-z]{2,8}(?:_[a-z0-9]{2,8})?)\.json$/;

export type NsBucket = {
  recipes: Record<string, string>;
  tags: Record<string, string>;
  textures: Record<string, string>;
  models: Record<string, string>;
  langs: Record<string, string>;
};

export type AnalyzeJarResult = {
  byNs: Record<string, NsBucket>;
  namespaces: string[];
};

/**
 * 読み込んだ JSZip インスタンスからアセットを抽出し、名前空間ごとに分離したオブジェクトを組み立てます。
 * @param zip JSZip のインスタンス
 * @returns 抽出されたデータ（名前空間別）と検出された名前空間一覧
 */
export async function analyzeJar(zip: JSZip): Promise<AnalyzeJarResult> {
  const byNs: Record<string, NsBucket> = {};
  const ensureNs = (ns: string): NsBucket =>
    (byNs[ns] ||= { recipes: {}, tags: {}, textures: {}, models: {}, langs: {} });

  const namespaces = new Set<string>();
  const paths = Object.keys(zip.files).filter(p => !zip.files[p].dir);

  for (const path of paths) {
    let m;
    if ((m = path.match(RECIPE_PATH))) {
      const [, ns, id] = m;
      // 共有ネームスペースのレシピは取り込まない。mod が同梱した data/minecraft/recipes を
      // 送ると、全プロジェクトが共有する minecraft の索引にバニラのレシピが流れ込む。
      if (isSharedNamespace(ns)) continue;
      namespaces.add(ns);
      ensureNs(ns).recipes[id] = await zip.files[path].async("string");
    } else if ((m = path.match(TAG_PATH))) {
      const [, ns, id] = m;
      ensureNs(ns).tags[id] = await zip.files[path].async("string");
    } else if ((m = path.match(TEXTURE_PATH))) {
      const [, ns, id] = m;
      const bytes = new Uint8Array(await zip.files[path].async("arraybuffer"));
      ensureNs(ns).textures[`${id}.png`] = bytesToBase64(bytes);
    } else if ((m = path.match(MODEL_PATH))) {
      const [, ns, id] = m;
      ensureNs(ns).models[id] = await zip.files[path].async("string");
    } else if ((m = path.match(LANG_PATH))) {
      const [, ns, id] = m;
      ensureNs(ns).langs[id] = await zip.files[path].async("string");
    }
  }

  // 共有ネームスペースはタグだけを送る。テクスチャやモデル、言語ファイルまで送ると、
  // 後から投稿された jar のバニラアセットが全プロジェクトの描画結果を上書きする。
  for (const ns of Object.keys(byNs)) {
    if (!isSharedNamespace(ns)) continue;
    byNs[ns] = { recipes: {}, tags: byNs[ns].tags, textures: {}, models: {}, langs: {} };
  }

  return {
    byNs,
    namespaces: Array.from(namespaces)
  };
}

/**
 * Uint8Array のバイナリデータを、ブラウザのスタック制限を避けて安全に base64 にエンコードします。
 * @param bytes 
 * @returns base64文字列
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
