import { localeToFileMap, type AppLocale } from "@/i18n/routing";

/**
 * レシピCDN（mp-recipe）からアイテムの表示名を取得するモジュール。
 *
 * 名前の実体は jar 由来の言語ファイルで、CDN 側が `assets/<ns>/lang/<locale>.json` として
 * 保持している。ここではその解決APIを叩くだけに留め、modparks 側では名前を持たない。
 */

/** CDN の `/api/names` が1リクエストで受け付けるID数の上限。 */
const MAX_IDS_PER_REQUEST = 500;

/** 名前は取り込みのたびに変わりうるため、画像ほど長くはキャッシュしない。 */
const REVALIDATE_SECONDS = 300;

/**
 * アプリのロケールを Minecraft のロケール名に変換します。
 * `messages/` のファイル名がそのまま Minecraft の表記（ja_jp など）と一致しているため、
 * i18n の対応表をそのまま使えます。
 * @param locale アプリのロケール（例: "ja"）
 */
export function toMinecraftLocale(locale: string): string | null {
  return localeToFileMap[locale as AppLocale] ?? null;
}

/**
 * アイテムIDをまとめて表示名に解決します。
 * 未翻訳のIDは結果に含まれないため、呼び出し側で表示上の既定値を決めてください。
 *
 * 名前が引けなくてもレシピ一覧自体は表示できるべきなので、失敗時は空の結果を返します。
 * @param cdnUrl レシピCDNのベースURL
 * @param ids アイテムID一覧（例: ["mymod:widget"]）
 * @param locale アプリのロケール（例: "ja"）
 * @returns アイテムID -> 表示名
 */
export async function fetchItemNames(
  cdnUrl: string,
  ids: string[],
  locale: string
): Promise<Record<string, string>> {
  const mcLocale = toMinecraftLocale(locale);
  if (!mcLocale) return {};

  const unique = [...new Set(ids)];
  if (unique.length === 0) return {};

  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += MAX_IDS_PER_REQUEST) {
    chunks.push(unique.slice(i, i + MAX_IDS_PER_REQUEST));
  }

  const results = await Promise.all(chunks.map((chunk) => fetchChunk(cdnUrl, chunk, mcLocale)));
  return Object.assign({}, ...results) as Record<string, string>;
}

/**
 * 1リクエスト分のIDを解決します。
 * @param cdnUrl レシピCDNのベースURL
 * @param ids アイテムID一覧（上限内）
 * @param mcLocale Minecraftのロケール名（例: "ja_jp"）
 */
async function fetchChunk(
  cdnUrl: string,
  ids: string[],
  mcLocale: string
): Promise<Record<string, string>> {
  const url = `${cdnUrl}/api/names?ids=${encodeURIComponent(ids.join(","))}&lang=${encodeURIComponent(mcLocale)}`;
  try {
    const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) {
      console.warn(`Failed to fetch item names: ${res.status} ${res.statusText}`);
      return {};
    }
    const body = (await res.json()) as { names?: Record<string, string> };
    return body.names ?? {};
  } catch (e) {
    console.warn("Failed to fetch item names:", e);
    return {};
  }
}
