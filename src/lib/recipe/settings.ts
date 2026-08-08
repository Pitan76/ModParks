/**
 * @fileoverview プロジェクトごとのレシピ画像の見せ方。
 *
 * 2つの設定は性質が違います。`tagNs` は描かれるアイテム自体を変えるためレシピCDNへ渡す必要があり、
 * `crop` は同じ絵の切り出し方でしかないため表示側のCSSで足ります。crop をCDNへ渡すと、
 * クリップ量ごとに同じ絵を作り直して保管させることになるので、URLには載せません。
 *
 * 項目が増えるたびにマイグレーションを積まなくて済むよう、1列のJSONにまとめて持ちます。
 */

/** 背景のネイティブ解像度。クリップ量はこの座標系のpxで数えます。 */
const NATIVE_W = 118;
const NATIVE_H = 56;

/** 余白をクリップしない既定値。 */
export const DEFAULT_CROP = 0;

/**
 * クリップできる上限（ネイティブpx）。
 * ここを超えるとスロットの中身まで削れて、何のレシピか読めない絵になります。
 */
export const MAX_CROP = 8;

/** レシピ画像の見せ方。未設定の項目はCDN側の既定（バニラのみ・クリップなし）に従います。 */
export type RecipeSettings = {
  /** タグの構成アイテムとして追加で採用するネームスペース。`["*"]` ですべて */
  tagNs?: string[];
  /** 上下左右から均等に削る余白の量（ネイティブpx） */
  crop?: number;
};

/** 何も設定されていないときの見せ方。 */
export const DEFAULT_RECIPE_SETTINGS: RecipeSettings = {};

/** 「すべてのネームスペースを使う」を表す指定値。 */
export const ALL_NAMESPACES = "*";

/**
 * クリップ量を受け付ける範囲へ丸めます。
 * @param value 判定対象の値
 * @returns 正規化されたクリップ量（ネイティブpx）
 */
export function normalizeCrop(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return DEFAULT_CROP;
  return Math.min(n, MAX_CROP);
}

/**
 * 入力されたネームスペースの文字列を配列に直します。
 * @param value カンマ区切りの文字列
 */
export function parseNamespaceList(value: string): string[] {
  return Array.from(new Set(value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)));
}

/**
 * 保存された設定を、フォームに出せる形へ直します。
 * @param settings 保存済みの設定
 */
export function toNamespaceInput(settings: RecipeSettings | null | undefined): string {
  return (settings?.tagNs ?? []).join(", ");
}

/**
 * 受け取った値を保存できる形に整えます。
 *
 * 既定と同じ項目は落とします。残しておくと、CDN側の既定を変えたときに
 * 古い保存値が既定の変更を打ち消してしまいます。
 * @param input 画面から受け取った値
 */
export function normalizeRecipeSettings(input: unknown): RecipeSettings {
  const raw = (input ?? {}) as { tagNs?: unknown; crop?: unknown };
  const out: RecipeSettings = {};

  const tagNs = Array.isArray(raw.tagNs) ? raw.tagNs.filter((v): v is string => typeof v === "string") : [];
  if (tagNs.length > 0) out.tagNs = parseNamespaceList(tagNs.join(","));

  const crop = normalizeCrop(raw.crop);
  if (crop !== DEFAULT_CROP) out.crop = crop;
  return out;
}

/**
 * レシピCDNへ渡す `tagNs` クエリの値を返します。
 * @param settings 保存済みの設定
 * @returns 渡す必要がなければ null
 */
export function tagNsQuery(settings: RecipeSettings | null | undefined): string | null {
  const list = settings?.tagNs ?? [];
  if (list.length === 0) return null;
  return list.includes(ALL_NAMESPACES) ? ALL_NAMESPACES : list.join(",");
}

/** 切り抜きをCSSで表現するための寸法。いずれも百分率です。 */
export type CropGeometry = {
  aspectRatio: string;
  width: string;
  height: string;
  left: string;
  top: string;
};

/**
 * 上下左右から均等に削るための寸法を求めます。
 *
 * すべて百分率で返すのは、表示幅やデバイスピクセル比が変わっても同じ切り抜きにするためです。
 * pxで返すと、グリッドの列数が変わるたびに削れる量がずれます。
 * @param crop 削る量（ネイティブpx）
 * @returns クリップ不要なら null
 */
export function cropGeometry(crop: number | undefined): CropGeometry | null {
  const n = normalizeCrop(crop);
  if (n === DEFAULT_CROP) return null;

  const w = NATIVE_W - n * 2;
  const h = NATIVE_H - n * 2;
  return {
    aspectRatio: `${w} / ${h}`,
    width: `${(NATIVE_W / w) * 100}%`,
    height: `${(NATIVE_H / h) * 100}%`,
    left: `${(-n / w) * 100}%`,
    top: `${(-n / h) * 100}%`,
  };
}
