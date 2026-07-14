/**
 * プラットフォーム内広告の表示モード設定。
 * 環境変数 `NEXT_PUBLIC_ADS_MODE` で制御する。
 *
 * - "off"     : 広告枠を一切表示しない（本番デフォルト）
 * - "preview" : 実際の広告は出さず、設置位置のみをプレースホルダーで表示する
 * - "on"      : 実際の広告を配信する
 */
export type AdsMode = "off" | "preview" | "on";

/** 現在の広告表示モードを返す。未設定・不正値は "off" とする */
export function getAdsMode(): AdsMode {
  const mode = process.env.NEXT_PUBLIC_ADS_MODE;
  if (mode === "preview" || mode === "on") return mode;
  return "off";
}
