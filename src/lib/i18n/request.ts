import { getRequestConfig } from "next-intl/server";
import type { AbstractIntlMessages } from "next-intl";
import { routing, AppLocale } from "./routing";

/**
 * ロケールごとの翻訳ファイル読み込み。
 *
 * 以前は `import(\`../../lang/${file}.json\`)` と書いていたが、変数を含む
 * import はバンドラが解決先を決められないため `lang/` 配下の全 JSON が
 * 同じチャンクへまとめて取り込まれていた。表示に使わない言語まで
 * Isolate の起動時に評価されるので、ロケールごとに入口を分けている。
 */
const MESSAGE_LOADERS: Record<AppLocale, () => Promise<{ default: AbstractIntlMessages }>> = {
  ja: () => import("../../lang/ja_jp.json"),
  en: () => import("../../lang/en_us.json"),
};

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = routing.locales.includes(requested as AppLocale)
    ? (requested as AppLocale)
    : routing.defaultLocale;

  return {
    locale,
    messages: (await MESSAGE_LOADERS[locale]()).default,
  };
});
