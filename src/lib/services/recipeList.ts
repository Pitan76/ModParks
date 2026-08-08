import { localeToFileMap, type AppLocale } from "@/lib/i18n/routing";
import { tagNsQuery, type RecipeSettings } from "@/lib/recipe/settings";

/**
 * レシピCDN（mp-recipe）からネームスペース単位のレシピ索引を取得するモジュール。
 *
 * 全体版の `/api/list.json` は全Mod分を含むため、1プロジェクトの表示には使いません。
 * アイテム名はCDN側が索引に同梱して返すので、名前解決のための追加リクエストは発生しません。
 */

/** 索引はアイテム名を含み取り込みのたびに変わるため、画像ほど長くはキャッシュしない。 */
const REVALIDATE_SECONDS = 60;

/** CDNが返す1レシピの形。`name` は未翻訳ならアイテムIDがそのまま入る。 */
export type RecipeListEntry = {
  id: string;
  result: string | null;
  type: string;
  name: string;
  /** タグ由来の素材を持ち、素材が切り替わりうる。持たない索引は静止画として扱う */
  tagged?: boolean;
};

/** レシピCDNのR2直接配信の情報。`base` が空、または未提供なら直接配信は使えません。 */
export type RecipeAssets = {
  base: string;
  rv: string;
};

/** ネームスペース1つ分の索引。 */
export type NamespaceList = {
  namespace: string;
  version: string;
  recipes: RecipeListEntry[];
  assets?: RecipeAssets;
};

/** レシピCDNの既定の拡大率。R2のキーに含まれるため、CDN側の DEFAULT_SCALE と揃える。 */
const IMAGE_SCALE = 2;

/** レシピCDNの既定のタグ位置。同上。 */
const IMAGE_TAG_OFFSET = 0;

/**
 * R2 のキーに載る、タグに使うネームスペースの部分を組み立てます。
 *
 * CDN 側の `tagNamespaceKey` と同じ規則です。既定（バニラのみ）では空文字を返します。
 * ここがずれると、生成済みの画像があるのに直接配信が 404 になり、毎回 Worker が起きます。
 * @param settings プロジェクトの設定
 */
function tagNsKey(settings: RecipeSettings | null | undefined): string {
  const query = tagNsQuery(settings);
  if (!query) return "";
  if (query === "*") return "~*";

  // CDN 側は既定の minecraft を必ず含めたうえで並べ替えるため、こちらも同じ形に揃える。
  const list = Array.from(new Set(["minecraft", ...query.split(",")])).sort();
  // 追加が minecraft だけなら既定と同じ絵になり、CDN 側のキーには何も付かない。
  if (list.length === 1) return "";
  return `~${list.join(".")}`;
}

/**
 * アプリのロケールを Minecraft のロケール名に変換します。
 * `messages/` のファイル名がそのまま Minecraft の表記（ja_jp など）と一致しているため、
 * i18n の対応表をそのまま使えます。
 * @param locale アプリのロケール（例: "ja"）
 */
export function toMinecraftLocale(locale: string): string | null {
  return localeToFileMap[locale as AppLocale] ?? null;
}

/** 表示に必要な形にほぐした1レシピ。 */
export type RecipeItem = {
  id: string;
  /** 完成品のアイテム名。未翻訳ならアイテムIDが入る */
  name: string;
  /** レシピ画像のURL。直接配信が使えるならR2のURL */
  url: string;
  /** `url` が404だったときの取得先。CDNのWorkerが画像を生成して返す */
  fallbackUrl: string;
};

/**
 * レンダリング済み画像をR2から直接取るURLを組み立てます。
 *
 * CDNのWorkerを起こさずに済むぶん安く速く返りますが、まだ生成されていない画像は404になります。
 * 呼び出し側は404のときだけ {@link RecipeItem.fallbackUrl} へ切り替えてください（Workerが生成して
 * R2へ保存するため、次回からは直接ヒットします）。
 * @param assets CDNが返した配信情報
 * @param namespace ネームスペース
 * @param itemId レシピID（ネームスペースを除いた部分）
 * @param version アセットバージョン
 * @returns 直接配信できないときは null
 */
function directUrl(
  assets: RecipeAssets | undefined,
  namespace: string,
  itemId: string,
  version: string,
  ext: string,
  settings: RecipeSettings | null | undefined
): string | null {
  if (!assets?.base || !version || version === "0") return null;

  const key = `cache/img/${assets.rv}/${namespace}/${version}/${itemId}@${IMAGE_SCALE}+${IMAGE_TAG_OFFSET}${tagNsKey(settings)}.${ext}`;
  const base = assets.base.endsWith("/") ? assets.base.slice(0, -1) : assets.base;
  return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * 索引を表示用のレシピ一覧に変換します。
 * @param cdnUrl レシピCDNのベースURL
 * @param lists ネームスペース単位の索引
 * @param settings プロジェクトのレシピ表示設定。`crop` は表示側のCSSで効くためここでは使いません
 */
export function toRecipeItems(
  cdnUrl: string,
  lists: NamespaceList[],
  settings?: RecipeSettings | null
): RecipeItem[] {
  const tagNs = tagNsQuery(settings);
  return lists.flatMap(({ version, recipes, assets }) =>
    recipes.map(({ id, name, tagged }) => {
      const [namespace, itemId] = id.split(":");
      // 素材が切り替わるレシピだけアニメーションで見せる。静止画をGIFで配ると
      // 色数が落ちるうえPNGより重くなるため、タグを持たないものはPNGのままにする。
      const ext = tagged ? "gif" : "png";
      // URL にアセットバージョンを埋めると CDN 側がバージョン参照の R2 往復を省略でき、
      // レスポンスが immutable になるため再訪時はネットワークに出なくなる。
      // 未設定を意味する "0" のときに付けると、まだ何も入っていない画像を1年間焼き付けてしまう。
      //
      // `rv` も併せて載せる。レンダラーの更新や共通タグの追加では、このネームスペースの
      // アセットバージョンは動かない。URL が変わらないままだと、CDN が新しい絵を作っていても
      // immutable で焼き付いた古い応答をブラウザが1年間返し続ける。
      const query = new URLSearchParams();
      if (version && version !== "0") query.set("v", version);
      if (assets?.rv) query.set("rv", assets.rv);
      // 描かれるアイテム自体が変わるため、これだけは CDN へ渡す必要がある。
      if (tagNs) query.set("tagNs", tagNs);

      const qs = query.toString();
      const fallbackUrl = `${cdnUrl}/api/${namespace}/${itemId}.${ext}${qs ? `?${qs}` : ""}`;
      const direct = directUrl(assets, namespace, itemId, version, ext, settings);
      return { id, name, url: direct ?? fallbackUrl, fallbackUrl };
    })
  );
}

/**
 * 複数ネームスペースのレシピ索引をまとめて取得します。
 * @param cdnUrl レシピCDNのベースURL
 * @param namespaces 対象のネームスペース
 * @param locale アプリのロケール（例: "ja"）
 * @returns ネームスペース単位の索引。取得に失敗したものは含みません
 */
export async function fetchRecipeLists(
  cdnUrl: string,
  namespaces: string[],
  locale: string
): Promise<NamespaceList[]> {
  const mcLocale = toMinecraftLocale(locale);
  const lists = await Promise.all(namespaces.map((ns) => fetchOne(cdnUrl, ns, mcLocale)));
  return lists.filter((l): l is NamespaceList => l !== null);
}

/**
 * ネームスペース1つ分の索引を取得します。
 * 1つのネームスペースが落ちても他は表示できるべきなので、失敗時は null を返します。
 * @param cdnUrl レシピCDNのベースURL
 * @param namespace ネームスペース
 * @param mcLocale Minecraftのロケール名。null なら名前を要求しません
 */
async function fetchOne(
  cdnUrl: string,
  namespace: string,
  mcLocale: string | null
): Promise<NamespaceList | null> {
  const query = mcLocale ? `?lang=${encodeURIComponent(mcLocale)}` : "";
  const url = `${cdnUrl}/api/${encodeURIComponent(namespace)}/list.json${query}`;
  try {
    const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) {
      console.warn(`Failed to fetch recipe list for ${namespace}: ${res.status} ${res.statusText}`);
      return null;
    }
    return (await res.json()) as NamespaceList;
  } catch (e) {
    console.warn(`Failed to fetch recipe list for ${namespace}:`, e);
    return null;
  }
}
