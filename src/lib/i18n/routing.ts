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
  // 日本語は接頭辞なし、それ以外は `/en/...`。
  // URLだけをロケールの正とするため Accept-Language / Cookie による自動判定は行わない
  // (同一URLがクライアントによって別言語を返すと hreflang とインデックスが崩れるため)。
  localePrefix:    "as-needed",
  localeDetection: false,
});

const navigation = createNavigation(routing);

export const { Link, usePathname, useRouter } = navigation;

// 分割代入のままだと型が推論扱いになり、never を返す関数としての制御フロー解析
// （redirect 以降が到達不能と判断される）が効かないため、明示的に型を付け直す
export const redirect: typeof navigation.redirect = navigation.redirect;
