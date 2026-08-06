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

/**
 * AdSense のパブリッシャーID（`ca-pub-...`）。
 * HTML に出力される公開値なので秘匿不要。未設定なら実配信はしない。
 */
export function getAdsenseClient(): string {
  return process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";
}

/**
 * 広告枠の識別子 → AdSense の広告ユニットID の対応。
 * 空文字はユニット未発行を意味し、その枠は実配信しない。
 *
 * 枠を増やすときはここにも追記する（`AdSlot` の型で強制される）。
 */
const AD_SLOT_IDS = {
  "home-mid": "",
  "projects-top": "3376322277",
  "project-sidebar": "9291538212",
} as const;

/** 設置可能な広告枠の識別子 */
export type AdSlotName = keyof typeof AD_SLOT_IDS;

/** 広告枠に対応する広告ユニットIDを返す。未発行なら空文字 */
export function getAdSlotId(slot: AdSlotName): string {
  return AD_SLOT_IDS[slot];
}
