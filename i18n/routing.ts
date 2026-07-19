import { createNavigation } from "next-intl/navigation";
import { defineRouting } from "next-intl/routing";

// URLで使用する言語コードと、読み込む翻訳ファイル名（拡張子なし）のマッピング
// 法則:
// - 基本はファイル名（例: ja_jp）の "_" の前を取ってURLにする（例: ja）
// - cn_tw, cn_zh のようなバリエーションが必要な場合は、URLは cn-tw のようにする
export const localeToFileMap = {
  "ja": "ja_jp",
  "en": "en_us",
  // 必要に応じて以下のように追加できます:
  // "cn-tw": "cn_tw",
  // "cn-zh": "cn_zh",
} as const;

export type AppLocale = keyof typeof localeToFileMap;
export const locales = Object.keys(localeToFileMap) as AppLocale[];

export const routing = defineRouting({
  locales: locales,
  defaultLocale: "ja",
  localePrefix:  "never",
});

export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);
