/**
 * 静的スナップショットの生成。
 *
 * 常時公開する前提なので、載せ忘れより**消し忘れ**の方が重い。
 * 非公開化・削除・凍結が反映されないのは可用性ではなくコンプライアンスの問題。
 * そのため差分ではなく毎回の全件照合で、余分なオブジェクトを必ず消す。
 */
import { getDatabase } from "@/lib/db";
import { collectSnapshotData, type SnapshotData } from "./query";
import { SNAPSHOT_SCHEMA_VERSION, type SnapshotManifest } from "./publicView";
import { deleteKey, getSnapshotBucket, listKeys, putJson } from "./storage";
import { copyShell } from "./shell";

export type SnapshotResult = {
  projectCount: number;
  authorCount: number;
  deletedCount: number;
  shellFiles: number;
};

/** 検索インデックス。名前・作者・タグ程度の前方一致に割り切る */
function buildSearchIndex(data: SnapshotData) {
  return data.summaries.map((project) => ({
    slug: project.slug,
    title: project.title,
    author: project.authorName,
    type: project.type,
  }));
}

/**
 * 実体に無いオブジェクトを消す。
 *
 * 差分生成だけでは削除を拾えない。列挙して突き合わせる方が確実で、
 * 件数が数万に増えても R2 の list は安い。
 *
 * @returns 削除した件数
 */
async function pruneStale(
  bucket: R2Bucket,
  prefix: string,
  expected: Set<string>
): Promise<number> {
  const existing = await listKeys(bucket, prefix);
  let deleted = 0;

  for (const key of existing) {
    if (expected.has(key)) continue;
    await deleteKey(bucket, key);
    deleted++;
  }

  return deleted;
}

/**
 * スナップショットを生成して R2 へ書き出す。
 *
 * manifest は最後に書く。途中で落ちた場合に、読み手が不整合な状態を
 * 「完成したもの」と見なさないようにするため。
 */
export async function generateSnapshot(): Promise<SnapshotResult> {
  const db = await getDatabase();
  const bucket = await getSnapshotBucket();
  const data = await collectSnapshotData(db);

  const projectKeys = new Set<string>();
  for (const [slug, detail] of data.details) {
    const key = `projects/${slug}.json`;
    await putJson(bucket, key, detail);
    projectKeys.add(key);
  }

  const authorKeys = new Set<string>();
  for (const [username, author] of data.authors) {
    const key = `authors/${username}.json`;
    await putJson(bucket, key, author);
    authorKeys.add(key);
  }

  await putJson(bucket, "projects.json", data.summaries);
  await putJson(bucket, "search-index.json", buildSearchIndex(data));

  // 消し忘れを残さないため、書き終えてから実体に無いものを落とす
  const deletedCount =
    (await pruneStale(bucket, "projects/", projectKeys)) +
    (await pruneStale(bucket, "authors/", authorKeys));

  const shellFiles = await copyShell(bucket);

  const manifest: SnapshotManifest = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    generatedAt: Date.now(),
    projectCount: data.summaries.length,
    authorCount: data.authors.size,
  };
  await putJson(bucket, "manifest.json", manifest);

  return {
    projectCount: data.summaries.length,
    authorCount: data.authors.size,
    deletedCount,
    shellFiles,
  };
}
