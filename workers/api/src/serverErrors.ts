import { ServerErrors as ja } from "../../../src/lang/ja_jp.json";
import { ServerErrors as en } from "../../../src/lang/en_us.json";
import { defaultLocale, locales, type AppLocale } from "@modparks/core/i18n/locales";
import type { ServerErrorTranslator } from "@modparks/core/i18n/serverErrors";

/**
 * modparks-api から返すエラー文言の翻訳。
 *
 * Next 側は next-intl の getTranslations("ServerErrors") を使うが、ここには
 * next-intl が無い。翻訳の正本は lang/*.json のまま一本化したいので直接読む。
 *
 * ServerErrors だけを名前付きで import しているのは、esbuild が JSON の
 * トップレベルのキーを個別に tree-shaking できるから。ja_jp.json 全体は
 * 約 150 KB あるが、これで取り込まれるのは ServerErrors の枝（数 KB）だけになり、
 * isolate 起動時に評価する量を増やさずに済む。
 */
const MESSAGES: Record<AppLocale, unknown> = { ja, en };

/** Next の middleware とワーカーが付与する表示言語の Cookie */
const LOCALE_COOKIE = "NEXT_LOCALE";

/**
 * 要求の表示言語を決める。
 *
 * API の URL には言語の接頭辞が無いので Cookie だけを見る。Cookie は
 * ページを表示するたびに付け直されるため、直前に見ていたページの言語になる。
 */
export function resolveLocale(req: Request): AppLocale {
  const cookie = req.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key !== LOCALE_COOKIE) continue;

    const value = rest.join("=");
    if ((locales as string[]).includes(value)) return value as AppLocale;
  }

  return defaultLocale;
}

/** "project.slugTaken" のような階層キーを辿る */
function lookup(tree: unknown, key: string): string | undefined {
  let node: unknown = tree;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }

  return typeof node === "string" ? node : undefined;
}

/**
 * 要求の言語に合わせた翻訳関数を返す。
 *
 * キーが見つからなければキーをそのまま返す。これは翻訳漏れであって本来は
 * 起きてはならないが、保存の応答そのものを 500 にするよりは原因が見える形で
 * 返す方がよい。漏れはテストで検出する（apiServerErrors.test.ts）。
 */
export function serverErrorsFor(req: Request): ServerErrorTranslator {
  const tree = MESSAGES[resolveLocale(req)];

  return (key) => lookup(tree, key) ?? key;
}
