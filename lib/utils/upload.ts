/**
 * クライアント側の R2 アップロード共通処理。
 * presign エンドポイントで署名付きURLを取得し、R2 へ PUT する一連の流れを集約する。
 * （アバター / プロジェクトアイコン / Mod ファイルの各アップロードで共有）
 */

export interface UploadTarget {
  type: "icon" | "mod" | "avatar" | "media";
  /** icon / mod では必須。新規プロジェクト作成時は "new-project" を渡す */
  projectSlug?: string;
}

export interface UploadOptions {
  /** presign 失敗時のフォールバックメッセージ（サーバーが error を返した場合はそちらを優先） */
  presignError?: string;
  /** PUT 失敗時のメッセージ */
  uploadError?: string;
}

/**
 * ファイルを R2 にアップロードし、公開URLを返す。
 * @throws presign / PUT に失敗した場合
 */
export async function uploadFileToR2(
  file: File,
  target: UploadTarget,
  opts: UploadOptions = {}
): Promise<{ publicUrl: string }> {
  const contentType = file.type || "application/octet-stream";

  const presignRes = await fetch("/api/upload/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType,
      type: target.type,
      ...(target.projectSlug ? { projectSlug: target.projectSlug } : {}),
    }),
  });

  if (!presignRes.ok) {
    const body = (await presignRes.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || opts.presignError || "Failed to get presigned URL");
  }

  const { uploadUrl, publicUrl } = (await presignRes.json()) as { uploadUrl: string; publicUrl: string };

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });

  if (!uploadRes.ok) {
    throw new Error(opts.uploadError || "Failed to upload file");
  }

  return { publicUrl };
}
