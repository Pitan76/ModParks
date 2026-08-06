import { locales, type AppLocale } from "./routing";

/**
 * 言語切替UIに出す表示名。
 * 言語名はその言語自身の表記（endonym）で出すのが慣例で、UIロケールに追従させると
 * 「読めない言語で書かれた自分の言語名」になってしまうため、翻訳ファイルではなくここに置く。
 */
const LOCALE_LABELS: Record<AppLocale, string> = {
  ja: "🇯🇵 日本語",
  en: "🇺🇸 English",
};

export interface LocaleOption {
  value: AppLocale;
  label: string;
}

/** routing.ts の locales と並びを揃えた、言語セレクタ用の選択肢 */
export const LOCALE_OPTIONS: LocaleOption[] = locales.map((value) => ({
  value,
  label: LOCALE_LABELS[value],
}));
