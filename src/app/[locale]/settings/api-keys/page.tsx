import { redirect } from "@/lib/i18n/routing";
import { getLocale } from "next-intl/server";

/**
 * APIキーは開発者設定のタブに統合された。
 * 旧URLのブックマークが切れないよう、ここは転送だけを担う。
 */
export default async function ApiKeysSettingsPage() {
  redirect({ href: "/settings/developer", locale: await getLocale() });
}
