import { userSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Database } from "@/lib/db";

export type ExternalSyncAvailability = {
  modrinth: boolean;
  curseforge: boolean;
};

/**
 * Modrinth / CurseForge への同時アップロード・一括反映を提供できるかを判定する。
 *
 * プロジェクトが連携済み（外部IDあり）で、かつ操作者本人が書き込み用のキー/トークンを
 * 設定している場合だけ true。片方でも欠けると外部APIを呼べないため、UI 側は
 * この判定でチェックボックスの表示・活性を決める。
 *
 * バージョン追加ページと編集画面の双方で同じ条件が要るため、ここに集約している。
 */
export async function getExternalSyncAvailability(
  db: Database,
  project: { modrinthId: string | null; curseforgeId: string | null },
  userId: string | undefined,
): Promise<ExternalSyncAvailability> {
  if (!userId) return { modrinth: false, curseforge: false };

  const settings = await db
    .select({
      modrinthApiKey: userSettings.modrinthApiKey,
      curseforgeUploadApiToken: userSettings.curseforgeUploadApiToken,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .get();

  return {
    modrinth: !!project.modrinthId && !!settings?.modrinthApiKey,
    curseforge: !!project.curseforgeId && !!settings?.curseforgeUploadApiToken,
  };
}
