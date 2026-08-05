import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkFeatureEnabled } from "@/lib/runtime/guard";
import { buildR2Key, getR2PublicUrl } from "@/lib/r2";
import { getR2S3Config, createPresignedPutUrl } from "@/lib/r2Presign";
import { createId } from "@paralleldrive/cuid2";
import { checkProjectUploadAccess, type UploadActor } from "@/lib/upload/access";
import {
  isAllowedUpload,
  isUploadType,
  MAX_UPLOAD_BYTES,
  NEW_PROJECT_SLUG,
  type UploadType,
} from "@/lib/upload/fileTypes";

interface PresignRequest {
  fileName: string;
  contentType: string;
  type: UploadType;
  fileSize: number;
  projectSlug?: string;
}

/** 入力検証の結果。失敗時はそのまま HTTP 応答に使う。 */
type Parsed = { ok: true; value: PresignRequest } | { ok: false; status: number; error: string };

function invalid(error: string, status = 400): Parsed {
  return { ok: false, status, error };
}

/**
 * リクエストボディを検証する。
 *
 * type は R2 キーの先頭にそのまま埋め込まれるので、型アサーションでは足りない。
 * `../evil` のような値が通ると、バケットの任意プレフィックスへの署名を発行できてしまう。
 * fileSize も必須。presigned URL の PUT は Worker を通らないため、
 * ここで確定させたバイト数を署名に焼き込む以外に上限を効かせる手段が無い。
 */
function parseRequest(body: unknown): Parsed {
  const { fileName, contentType, type, projectSlug, fileSize } = (body ?? {}) as Record<
    string,
    unknown
  >;

  if (typeof fileName !== "string" || !fileName) return invalid("Missing fields");
  if (typeof contentType !== "string" || !contentType) return invalid("Missing fields");
  if (!isUploadType(type)) return invalid("Invalid type");
  if (typeof fileSize !== "number" || !Number.isInteger(fileSize) || fileSize <= 0) {
    return invalid("Missing or invalid fileSize");
  }
  if (fileSize > MAX_UPLOAD_BYTES) {
    return invalid(`File size exceeds ${MAX_UPLOAD_BYTES / 1024 / 1024}MB limit`, 413);
  }
  if (projectSlug !== undefined && typeof projectSlug !== "string") return invalid("Missing fields");
  if (type !== "avatar" && !projectSlug) return invalid("Missing projectSlug");
  if (!isAllowedUpload(type, contentType, fileName)) {
    return invalid(`Invalid file type for ${type}`);
  }

  return { ok: true, value: { fileName, contentType, type, fileSize, projectSlug } };
}

/**
 * アップロード先に対する権限を確認する。
 *
 * 未保存プロジェクトはまだ DB にレコードが無く所有権を確認できない。
 * 誰でも通せてしまう経路なので、アイコン（画像）に限定したうえで
 * キーを呼び出し元のユーザーIDで区切り、影響範囲を閉じる（キー生成は buildKey 側）。
 */
async function authorize(req: PresignRequest, actor: UploadActor) {
  if (req.type === "avatar") return { ok: true } as const;
  if (req.projectSlug !== NEW_PROJECT_SLUG) {
    return await checkProjectUploadAccess(req.projectSlug!, actor);
  }
  if (req.type !== "icon") {
    return { ok: false, status: 400, error: "Invalid type for new project" } as const;
  }
  return { ok: true } as const;
}

function buildKey(req: PresignRequest, actor: UploadActor): string {
  const uniqueId = createId();
  const safeFileName = req.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

  if (req.type !== "avatar" && req.projectSlug === NEW_PROJECT_SLUG) {
    return `${req.type}/${NEW_PROJECT_SLUG}/${actor.id}/${Date.now()}/${uniqueId}/${safeFileName}`;
  }

  const slugOrId = req.type === "avatar" ? actor.id : req.projectSlug!;
  return buildR2Key(req.type, slugOrId, `${uniqueId}/${safeFileName}`);
}

/**
 * アップロード先 URL を決める。
 *
 * 本番は R2 の S3 互換 API で presigned URL を発行し、ブラウザ → R2 へ直接 PUT させる。
 * これによりアップロードのバイト転送が OpenNext Worker を一切通らない。
 * S3 クレデンシャル未設定（開発時など）は Worker 経由の /api/upload/direct に落とす。
 */
async function resolveUploadUrl(key: string, fileSize: number): Promise<string> {
  const s3Config = getR2S3Config();
  if (!s3Config) return `/api/upload/direct?key=${encodeURIComponent(key)}`;
  return await createPresignedPutUrl(key, s3Config, fileSize);
}

/** POST /api/upload/presign
 * アップロード前に R2 の署名付き URL を発行する
 * ボディ: { fileName, contentType, fileSize, type, projectSlug? }
 */
export async function POST(req: NextRequest) {
  if (!await checkFeatureEnabled("upload")) {
    return NextResponse.json({ error: "Uploads are temporarily disabled" }, { status: 503, headers: { "Retry-After": "3600" } });
  }

  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = parseRequest(await req.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  const access = await authorize(parsed.value, session.user);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const key = buildKey(parsed.value, session.user);

  try {
    const uploadUrl = await resolveUploadUrl(key, parsed.value.fileSize);
    return NextResponse.json({ key, uploadUrl, publicUrl: getR2PublicUrl(key) });
  } catch (err) {
    // 署名失敗時はフォールバックせず可視化する（設定ミスを黙って握りつぶさない）
    console.error("Failed to create presigned URL:", err);
    return NextResponse.json({ error: "Failed to create upload URL" }, { status: 500 });
  }
}
