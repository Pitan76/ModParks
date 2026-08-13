import { getDatabase } from "@/lib/db";
import { versions } from "@/db/schema";
import { eq, getTableColumns } from "drizzle-orm";
import { displayDownloadsSql } from "@/lib/queries/versionList";

/**
 * IDを指定してバージョン詳細を取得する Server Action。
 */
export const getVersionById = async (versionId: string) => {
  const db = await getDatabase();

  const version = await db
    .select({
      ...getTableColumns(versions),
      // 累積カウンタに未反映のダウンロードを足して、一覧と同じ数字を出す
      downloads: displayDownloadsSql,
    })
    .from(versions)
    .where(eq(versions.id, versionId))
    .get();

  if (!version) return null;

  return version;
};
