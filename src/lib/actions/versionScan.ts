import * as core from "@modparks/core/versions/scan";
import { nextJarClient } from "@/lib/services/jar";
import { checkFeatureEnabled } from "@/lib/runtime/guard";
import { userNotifyContext } from "@/lib/notifications/notify";
import { getAdminWebhookUrl } from "@/lib/usage/webhook";
import type { Database } from "@/lib/db";

/**
 * バージョンファイル検査（Next 側のアダプタ）。本体は core/versions/scan.ts。
 *
 * 以前は "use server" 付きで、db を受け取る関数が Server Action として公開されていた。
 * ブラウザから呼ぶものではないため普通のサーバー関数にしている。
 */
export async function nextScanContext(db: Database): Promise<core.VersionScanContext> {
  return {
    notify: await userNotifyContext(db),
    jar: nextJarClient,
    r2PublicUrl: process.env.R2_PUBLIC_URL,
    isAnalysisEnabled: () => checkFeatureEnabled("jarAnalysis"),
    adminWebhookUrl: await getAdminWebhookUrl(),
  };
}

export async function scanVersionFile(db: Database, versionId: string, fileUrl: string, fileName: string) {
  await core.scanVersionFile(await nextScanContext(db), versionId, fileUrl, fileName);
}
