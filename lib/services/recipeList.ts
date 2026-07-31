import { localeToFileMap, type AppLocale } from "@/lib/i18n/routing";

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
};

/** ネームスペース1つ分の索引。 */
export type NamespaceList = {
  namespace: string;
  version: string;
  recipes: RecipeListEntry[];
};

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
  /** レシピ画像のURL */
  url: string;
};

/**
 * 索引を表示用のレシピ一覧に変換します。
 * @param cdnUrl レシピCDNのベースURL
 * @param lists ネームスペース単位の索引
 */
export function toRecipeItems(cdnUrl: string, lists: NamespaceList[]): RecipeItem[] {
  return lists.flatMap(({ version, recipes }) =>
    recipes.map(({ id, name }) => {
      const [namespace, itemId] = id.split(":");
      // URL にアセットバージョンを埋めると CDN 側がバージョン参照の R2 往復を省略でき、
      // レスポンスが immutable になるため再訪時はネットワークに出なくなる。
      // 未設定を意味する "0" のときに付けると、まだ何も入っていない画像を1年間焼き付けてしまう。
      const pin = version && version !== "0" ? `?v=${encodeURIComponent(version)}` : "";
      return { id, name, url: `${cdnUrl}/api/${namespace}/${itemId}.png${pin}` };
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
