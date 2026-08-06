/**
 * 表示テーマの種別。
 * - new: 標準テーマ（ModParks独自UI）
 * - legacy: 従来型テーマ
 * - plain: 軽量テーマ（ブラウザ標準優先・装飾最小）
 */
export type ThemeType = "new" | "legacy" | "plain";

export const THEME_TYPES: readonly ThemeType[] = ["new", "legacy", "plain"];

export const THEME_TYPE_STORAGE_KEY = "theme_type";

export const DEFAULT_THEME_TYPE: ThemeType = "new";

/**
 * 任意の文字列をThemeTypeへ正規化する。未知の値はnullを返す。
 */
export function parseThemeType(value: string | null | undefined): ThemeType | null {
  if (!value) return null;
  return THEME_TYPES.includes(value as ThemeType) ? (value as ThemeType) : null;
}

/**
 * localStorageに保存されたテーマ種別を読み出す。
 */
export function readStoredThemeType(): ThemeType {
  try {
    return parseThemeType(window.localStorage.getItem(THEME_TYPE_STORAGE_KEY)) ?? DEFAULT_THEME_TYPE;
  } catch (e) {
    return DEFAULT_THEME_TYPE;
  }
}

/**
 * テーマ種別をlocalStorageへ保存する。
 */
export function storeThemeType(themeType: ThemeType): void {
  try {
    window.localStorage.setItem(THEME_TYPE_STORAGE_KEY, themeType);
  } catch (e) {
    // ストレージ不可環境ではセッション内のみの切り替えとする
  }
}

/**
 * URLの?theme=を優先しつつ、保存済み設定へフォールバックしてテーマ種別を解決する。
 * URL指定があった場合はその値を保存する。
 */
export function resolveThemeType(themeParam: string | null | undefined): ThemeType {
  const fromUrl = parseThemeType(themeParam);
  if (!fromUrl) return readStoredThemeType();
  storeThemeType(fromUrl);
  return fromUrl;
}
