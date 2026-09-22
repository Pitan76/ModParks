"use server";

import { revalidatePath } from "next/cache";
import { syncExternalProjectData as syncCore } from "@modparks/core/projects/externalDownloads";
import { getAuthenticatedDb } from "@/lib/auth-helpers";

/**
 * 特定のプロジェクトの外部ダウンロード数を手動で同期する Server Action。
 * 本体は core/projects/externalDownloads.ts（cron は core の syncExternalDownloads を直接呼ぶ）。
 */
export const syncExternalProjectData = async (projectId: string) => {
  const { db, userId } = await getAuthenticatedDb();
  const { slug, externalDownloads } = await syncCore(db, userId, projectId, process.env.CURSEFORGE_FOR_STUDIOS_API_KEY);

  revalidatePath(`/projects/${slug}`);
  return { success: true, externalDownloads };
};
