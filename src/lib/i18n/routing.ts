import { createNavigation } from "next-intl/navigation";
import { defineRouting } from "next-intl/routing";
import { defaultLocale, locales } from "./locales";

export { localeToFileMap, locales, defaultLocale, type AppLocale } from "./locales";

export const routing = defineRouting({
  locales: locales,
  defaultLocale: defaultLocale,
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
