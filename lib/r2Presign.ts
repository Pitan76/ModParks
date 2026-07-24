/**
 * R2 の S3 互換 API を使って、ブラウザ → R2 へ直接 PUT するための
 * 署名付き（presigned）アップロード URL を発行する。
 *
 * これが使えると、アップロードのバイト転送が OpenNext Worker を一切通らなくなり、
 * Worker の CPU / メモリ負荷が発生しない（=「Worker を通すが軽くする」ストリーム化の一歩先）。
 *
 * S3 クレデンシャル（R2 の Access Key ID / Secret）が環境に無い場合は null を返し、
 * 呼び出し側は従来の /api/upload/direct（Worker 経由）にフォールバックする。
 */
import { AwsClient } from "aws4fetch";

export interface R2S3Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

/** 環境変数から R2 の S3 設定を読む。未設定（=フォールバック）なら null。 */
export function getR2S3Config(): R2S3Config | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  // wrangler.toml の r2_buckets.bucket_name と一致させる
  const bucket = process.env.R2_BUCKET_NAME || "modparks-storage";

  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

/**
 * 指定キーへの PUT 用 presigned URL を生成する。
 * @param key     R2 オブジェクトキー
 * @param config  R2 S3 設定
 * @param expiresSeconds 有効期限（秒）。既定 600（10分）
 */
export async function createPresignedPutUrl(
  key: string,
  config: R2S3Config,
  expiresSeconds = 600
): Promise<string> {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
  });

  // キーはスラッシュ区切りの各セグメントのみエンコード（区切りの "/" は保持）
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${encodedKey}`;

  const signed = await client.sign(
    `${endpoint}?X-Amz-Expires=${expiresSeconds}`,
    {
      method: "PUT",
      aws: { signQuery: true },
    }
  );

  return signed.url;
}
