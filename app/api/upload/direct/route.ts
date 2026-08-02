import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadToR2, getR2Bucket } from "@/lib/r2";
import { checkProjectUploadAccess, type UploadActor } from "@/lib/upload/access";
import {
  isAllowedUpload,
  uploadTypeFromKey,
  MAX_UPLOAD_BYTES,
  NEW_PROJECT_SLUG,
  UPLOAD_TYPES,
} from "@/lib/upload/fileTypes";

/** そのキーへ書いてよいかの判定結果。失敗時はそのまま HTTP 応答に使う。 */
type KeyCheck = { ok: true } | { ok: false; status: number; error: string };

const OK: KeyCheck = { ok: true };

function deny(error: string, status = 403): KeyCheck {
  return { ok: false, status, error };
}

/** アバターは本人の領域だけ。プロジェクト配下は所有権を DB で確認する必要がある。 */
function isOwnAvatarKey(key: string, actor: UploadActor): boolean {
  return key.startsWith(`avatar/${actor.id}/`);
}

function hasAllowedPrefix(key: string): boolean {
  return UPLOAD_TYPES.some((type) => key.startsWith(`${type}/`));
}

/**
 * presign が発行する未保存プロジェクト用キーは `icon/new-project/<userId>/...` の形。
 * ここを素通しにすると認証さえ通れば誰でも公開プレフィックス配下へ書けてしまう
 * （自オリジンでの保存型 XSS になる）ため、用途と所有者を必ず突き合わせる。
 */
function checkNewProjectKey(key: string, parts: string[], actor: UploadActor): KeyCheck {
  if (!key.startsWith("icon/")) return deny("Forbidden: Invalid key");
  if (parts[2] !== actor.id) return deny("Forbidden: Invalid key");
  return OK;
}

/** キーの形と、その宛先に対する書き込み権限をまとめて検証する。 */
async function checkUploadKey(key: string, actor: UploadActor): Promise<KeyCheck> {
  if (isOwnAvatarKey(key, actor)) return OK;
  if (!hasAllowedPrefix(key)) return deny("Forbidden: Invalid key prefix");
  if (key.startsWith("avatar/")) return deny("Forbidden: Invalid key");

  const parts = key.split("/");
  if (parts.length < 3) return deny("Forbidden: Invalid key format");

  const slug = parts[1];
  if (slug === NEW_PROJECT_SLUG) return checkNewProjectKey(key, parts, actor);

  return await checkProjectUploadAccess(slug, actor);
}

/**
 * 保存する Content-Type とサイズを検証する。
 *
 * 保存した Content-Type は配信時にそのまま返る可能性があるので、
 * presign と同じホワイトリストをここでも必ず通す。
 */
function checkPayload(key: string, contentType: string, contentLength: number): KeyCheck {
  if (contentLength > MAX_UPLOAD_BYTES) {
    return deny(`File size exceeds ${MAX_UPLOAD_BYTES / 1024 / 1024}MB limit`, 413);
  }

  const uploadType = uploadTypeFromKey(key);
  const fileName = key.split("/").pop() ?? "";
  if (!uploadType) return deny("Invalid file type", 400);
  if (!isAllowedUpload(uploadType, contentType, fileName)) return deny("Invalid file type", 400);

  return OK;
}

/** PUT /api/upload/direct
 * R2 への直接アップロードエンドポイント。
 * Cloudflare Workers の R2 バインディングでは presigned URL 発行が使えないため、
 * S3 クレデンシャル未設定時のフォールバック経路として Worker 経由で PUT を受ける。
 */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = new URL(req.url).searchParams.get("key");
  if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });

  const keyCheck = await checkUploadKey(key, session.user);
  if (!keyCheck.ok) {
    return NextResponse.json({ error: keyCheck.error }, { status: keyCheck.status });
  }

  // Content-Length が付いたリクエストボディは「長さ既知の ReadableStream」なので、
  // 全体をバッファに読み込まず、そのまま R2 へストリームで流す（Worker のメモリ/CPU 負荷を回避）。
  // ※長さ不明のストリームは R2 put() が受け付けないため、Content-Length 必須。
  const contentLength = Number(req.headers.get("content-length"));
  if (!Number.isInteger(contentLength) || contentLength <= 0) {
    return NextResponse.json({ error: "Missing or invalid Content-Length" }, { status: 411 });
  }

  const contentType = req.headers.get("content-type") || "application/octet-stream";
  const payloadCheck = checkPayload(key, contentType, contentLength);
  if (!payloadCheck.ok) {
    return NextResponse.json({ error: payloadCheck.error }, { status: payloadCheck.status });
  }

  if (!req.body) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  try {
    const R2 = await getR2Bucket();
    await uploadToR2(R2, key, req.body, contentType);
  } catch (err) {
    console.error("Upload Error:", err);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }

  return NextResponse.json({ success: true, key });
}
