import { redirect } from "next/navigation";

/**
 * APIキーは開発者設定のタブに統合された。
 * 旧URLのブックマークが切れないよう、ここは転送だけを担う。
 */
export default function ApiKeysSettingsPage() {
  redirect("/settings/developer");
}
