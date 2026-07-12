import { versions, versionLoaders, versionMcVersions } from "@/db/schema";

/** バージョン本体＋関連テーブル（ローダー / MCバージョン）への挿入に必要な入力 */
export interface VersionRecordInput {
  id: string;
  versionNumber: string;
  mcVersions: string[];
  loaders: string[];
  changelog: string;
  fileUrl: string;
  fileName: string;
  fileSize?: number | null;
  fileSha256?: string | null;
  projectId: string;
}

/**
 * versions テーブルと、その検索最適化用の versionLoaders / versionMcVersions を
 * まとめて挿入する共通ヘルパー。手動アップロードと GitHub Release 取り込みで共有する。
 */
export async function insertVersionRecord(db: any, input: VersionRecordInput): Promise<void> {
  await db.insert(versions).values({
    id: input.id,
    versionNumber: input.versionNumber,
    mcVersions: JSON.stringify(input.mcVersions),
    loaders: JSON.stringify(input.loaders),
    changelog: input.changelog,
    fileUrl: input.fileUrl,
    fileName: input.fileName,
    fileSize: input.fileSize ?? null,
    fileSha256: input.fileSha256 ?? null,
    projectId: input.projectId,
    createdAt: new Date(),
  }).run();

  if (input.loaders.length > 0) {
    await db.insert(versionLoaders).values(input.loaders.map((loader) => ({ versionId: input.id, loader }))).run();
  }
  if (input.mcVersions.length > 0) {
    await db.insert(versionMcVersions).values(input.mcVersions.map((mcVersion) => ({ versionId: input.id, mcVersion }))).run();
  }
}
