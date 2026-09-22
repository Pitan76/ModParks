import { Notifications as ja } from "../../../src/lang/ja_jp.json";
import { Notifications as en } from "../../../src/lang/en_us.json";
import type { NotificationMessage } from "@modparks/core/notifications/dispatch";

/**
 * ユーザー宛て通知の Discord 文言（modparks-api 側）。
 *
 * Next 側は next-intl の getTranslations("Notifications.message") を使う。文言は
 * `{actorName}` のような単純な差し込みだけで ICU の複数形などは使っていないので、
 * 同じ結果を差し込みで再現できる。Notifications だけを名前付きで import するのは、
 * 翻訳ファイル全体を載せず、その枝だけを tree-shaking で残すため（serverErrors.ts と同じ）。
 */
const MESSAGES: Record<"ja" | "en", Record<string, string>> = { ja: ja.message, en: en.message };

export const notificationMessage: NotificationMessage = async (locale, type, payload) => {
  const template = MESSAGES[locale][type] ?? "";

  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(payload[key as keyof typeof payload] ?? ""));
};
