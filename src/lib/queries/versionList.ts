/**
 * 公開バージョン一覧の共通クエリ。
 *
 * プロジェクト詳細・バージョン詳細・管理画面で同じ列と同じダウンロード数を出すため、
 * 列の定義をここに集約する。
 */
import { and, desc, eq, getTableName, isNull, sql } from "drizzle-orm";
import { versionDownloadDaily, versions } from "@/db/schema";
import type { Database } from "@/lib/db";

/** 一度に読み込む公開バージョン数。残りは「さらに読み込む」で継ぎ足す */
export const PROJECT_VERSIONS_PAGE_SIZE = 50;

/**
 * 表示用のダウンロード数。
 *
 * versions.downloads は Cron のロールアップでしか増えないため、それだけを出すと
 * 直近のダウンロードが最大 1 時間反映されない（利用者からは「数字がおかしい」に見える）。
 * まだ累積へ反映していない日次バッファの差分を足して、実数に一致させる。
 */
/**
 * 相関副問い合わせなので、テーブル名・列名は必ず明示的に修飾する。
 * drizzle の列参照は JOIN の有無で修飾の付き方が変わり、修飾なしだと
 * どちらのテーブルの列を指すかが黙って入れ替わりうるため、ここでは使わない。
 */
const daily = {
  table:  sql.identifier(getTableName(versionDownloadDaily)),
  count:  sql.identifier(versionDownloadDaily.count.name),
  synced: sql.identifier(versionDownloadDaily.syncedCount.name),
  linkId: sql.identifier(versionDownloadDaily.versionId.name),
};

const versionsTable = sql.identifier(getTableName(versions));
const versionsId = sql.identifier(versions.id.name);
const versionsDownloads = sql.identifier(versions.downloads.name);

export const displayDownloadsSql = sql<number>`${versionsTable}.${versionsDownloads} + COALESCE((
  SELECT SUM(buffer.${daily.count} - buffer.${daily.synced})
  FROM ${daily.table} AS buffer
  WHERE buffer.${daily.linkId} = ${versionsTable}.${versionsId}
), 0)`;

/** 公開一覧に出す列。ファイル本体の URL 以外の重い列は持ち出さない */
export const publicVersionColumns = {
  id:             versions.id,
  versionNumber:  versions.versionNumber,
  releaseChannel: versions.releaseChannel,
  changelog:      versions.changelog,
  mcVersions:     versions.mcVersions,
  loaders:        versions.loaders,
  fileName:       versions.fileName,
  fileSize:       versions.fileSize,
  downloads:      displayDownloadsSql,
  createdAt:      versions.createdAt,
  projectId:      versions.projectId,
  fileUrl:        versions.fileUrl,
  fileSha256:     versions.fileSha256,
};

/** アーカイブ済みを除いた公開バージョンを新しい順に取得する */
export async function listPublicProjectVersions(
  db: Database,
  projectId: string,
  { limit, offset = 0 }: { limit: number; offset?: number }
) {
  return db
    .select(publicVersionColumns)
    .from(versions)
    .where(and(eq(versions.projectId, projectId), isNull(versions.archivedAt)))
    .orderBy(desc(versions.createdAt))
    .limit(limit)
    .offset(offset)
    .all();
}

export type PublicProjectVersion = Awaited<ReturnType<typeof listPublicProjectVersions>>[number];

/** 公開バージョンの総数。「さらに読み込む」の要否判定に使う */
export async function countPublicProjectVersions(db: Database, projectId: string): Promise<number> {
  const row = await db
    .select({ count: sql<number>`count(*)` })
    .from(versions)
    .where(and(eq(versions.projectId, projectId), isNull(versions.archivedAt)))
    .get();

  return row?.count ?? 0;
}
