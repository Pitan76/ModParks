import { versions, versionLoaders, versionMcVersions } from "@/db/schema";
import type { Database } from "@/lib/db";

/** バージョン本体＋関連テーブル（ローダー / MCバージョン）への挿入に必要な入力 */
export interface VersionRecordInput {
  id: string;
  versionNumber: string;
  mcVersions: string[];
  loaders: string[];
  changelog: string;
  releaseChannel: string;
  fileUrl: string;
  fileName: string;
  fileSize?: number | null;
  fileSha256?: string | null;
  projectId: string;
  /** アップロードを実行したユーザ。信頼ポイントの加減点はこの人に入る */
  uploaderId: string;
}

/**
 * versions テーブルと、その検索最適化用の versionLoaders / versionMcVersions を
 * まとめて挿入する共通ヘルパー。手動アップロードと GitHub Release 取り込みで共有する。
 */
export async function insertVersionRecord(db: Database, input: VersionRecordInput): Promise<void> {
  const insertVersion = db.insert(versions).values({
    id: input.id,
    versionNumber: input.versionNumber,
    mcVersions: JSON.stringify(input.mcVersions),
    loaders: JSON.stringify(input.loaders),
    changelog: input.changelog,
    releaseChannel: input.releaseChannel,
    fileUrl: input.fileUrl,
    fileName: input.fileName,
    fileSize: input.fileSize ?? null,
    fileSha256: input.fileSha256 ?? null,
    projectId: input.projectId,
    uploaderId: input.uploaderId,
    createdAt: new Date(),
  });

  // 検索最適化テーブルは対象が無ければ挿入しない
  const indexInserts = [
    ...(input.loaders.length > 0
      ? [db.insert(versionLoaders).values(input.loaders.map((loader) => ({ versionId: input.id, loader })))]
      : []),
    ...(input.mcVersions.length > 0
      ? [db.insert(versionMcVersions).values(input.mcVersions.map((mcVersion) => ({ versionId: input.id, mcVersion })))]
      : []),
  ];

  // ローカル開発の SQLite ドライバは batch を持たないため、その場合は逐次実行する
  if (typeof db.batch !== "function") {
    for (const stmt of [insertVersion, ...indexInserts]) await stmt.run();
    return;
  }

  await db.batch([insertVersion, ...indexInserts]);
}
