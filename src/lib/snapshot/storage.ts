/**
 * スナップショットの保存先。
 *
 * ファイル配信用（modparks_storage）とは別のバケットを使う。
 * R2 のカスタムドメインはバケット全体を公開するため、公開専用にしておけば
 * 「置いたものは全部公開」が前提になり、誤配置の余地が消える。
 */

/** 出力のルートプレフィックス。読み手が形式を判断できるようにバージョンを含める */
export const SNAPSHOT_PREFIX = "v1";

/** 公開専用バケットのバインディングを取得する */
export async function getSnapshotBucket(): Promise<R2Bucket> {
  const env = await resolveEnv();
  const bucket = (env as { modparks_static?: R2Bucket }).modparks_static;
  if (!bucket) throw new Error("modparks_static binding not found");
  return bucket;
}

async function resolveEnv(): Promise<unknown> {
  if (process.env.NODE_ENV === "development" && process.release?.name === "node") {
    const { getCachedPlatformProxy } = await import("@/lib/proxy");
    return (await getCachedPlatformProxy()).env;
  }

  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  return (await getCloudflareContext({ async: true })).env;
}

/** 一覧・詳細などの JSON を書く。CDN に載るよう Cache-Control を付ける */
export async function putJson(bucket: R2Bucket, key: string, value: unknown): Promise<void> {
  await bucket.put(`${SNAPSHOT_PREFIX}/${key}`, JSON.stringify(value), {
    httpMetadata: {
      contentType: "application/json; charset=utf-8",
      // 取り下げが必要になったとき、削除の反映が遅れないよう短く保つ。
      // stale-while-revalidate は削除後も配信され続けるため使わない
      cacheControl: "public, max-age=300",
    },
  });
}

export async function deleteKey(bucket: R2Bucket, key: string): Promise<void> {
  await bucket.delete(`${SNAPSHOT_PREFIX}/${key}`);
}

/**
 * 指定プレフィックス配下のキーを列挙する（プレフィックスを除いた相対キー）。
 *
 * 差分生成は削除を拾えないため、実体との突き合わせに使う。
 * 非公開に戻した・DMCA で消した・退会した、が反映されないのは
 * 可用性ではなくコンプライアンスの問題になる。
 */
export async function listKeys(bucket: R2Bucket, prefix: string): Promise<Set<string>> {
  const keys = new Set<string>();
  const full = `${SNAPSHOT_PREFIX}/${prefix}`;
  let cursor: string | undefined;

  do {
    const page = await bucket.list({ prefix: full, cursor });
    for (const object of page.objects) {
      keys.add(object.key.slice(SNAPSHOT_PREFIX.length + 1));
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  return keys;
}
