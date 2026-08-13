/**
 * 公開バージョン一覧の共通クエリ。
 *
 * プロジェクト詳細・バージョン詳細・管理画面で同じ列と同じダウンロード数を出すため、
 * 列の定義をここに集約する。
 */
import { and, desc, eq, getTableName, isNull, sql } from "drizzle-orm";
import { versionDownloadDaily, versions } from "@/db/schema";
import type { Database } from "@/lib/db";

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

/**
 * 表示用のダウンロード数。
 *
 * versions.downloads は Cron のロールアップでしか増えないため、それだけを出すと
 * 直近のダウンロードが最大 1 時間反映されない（利用者からは「数字がおかしい」に見える）。
 * まだ累積へ反映していない日次バッファの差分を足して、実数に一致させる。
 */
export const displayDownloadsSql = sql<number>`${versionsTable}.${versionsDownloads} + COALESCE((
  SELECT SUM(buffer.${daily.count} - buffer.${daily.synced})
  FROM ${daily.table} AS buffer
  WHERE buffer.${daily.linkId} = ${versionsTable}.${versionsId}
), 0)`;

/** 一覧のプレビューに出す変更履歴の長さ。全文はバージョン詳細で読む */
const CHANGELOG_PREVIEW_CHARS = 200;

/**
 * 一覧に出す列。
 *
 * 一覧は全バージョンをまとめて画面へ運ぶため、行を軽く保つことが効いてくる。
 * ダウンロードURLは ID から組み立てられるので運ばない。変更履歴も 1 行の
 * プレビューにしか使わないので、先頭だけを切り出して渡す。
 */
export const publicVersionColumns = {
  id:             versions.id,
  versionNumber:  versions.versionNumber,
  releaseChannel: versions.releaseChannel,
  changelog:      sql<string>`SUBSTR(${versions.changelog}, 1, ${CHANGELOG_PREVIEW_CHARS})
    || CASE WHEN LENGTH(${versions.changelog}) > ${CHANGELOG_PREVIEW_CHARS} THEN '...' ELSE '' END`,
  mcVersions:     versions.mcVersions,
  loaders:        versions.loaders,
  fileSize:       versions.fileSize,
  downloads:      displayDownloadsSql,
  createdAt:      versions.createdAt,
};

/**
 * アーカイブ済みを除いた公開バージョンを新しい順に取得する。
 *
 * 絞り込みも並び替えもページ送りも画面側で行うため、ここでは全件返す。
 * 途中で打ち切ると、絞り込みの選択肢と件数が「読み込めた分」に依存して狂う。
 */
export async function listPublicProjectVersions(db: Database, projectId: string) {
  return db
    .select(publicVersionColumns)
    .from(versions)
    .where(and(eq(versions.projectId, projectId), isNull(versions.archivedAt)))
    .orderBy(desc(versions.createdAt))
    .all();
}

export type PublicProjectVersion = Awaited<ReturnType<typeof listPublicProjectVersions>>[number];
