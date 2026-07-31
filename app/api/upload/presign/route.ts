import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildR2Key, getR2PublicUrl } from "@/lib/r2";
import { getR2S3Config, createPresignedPutUrl } from "@/lib/r2Presign";
import { createId } from "@paralleldrive/cuid2";
import { isAllowedUpload } from "@/lib/upload/fileTypes";

/** POST /api/upload/presign
 * アップロード前に R2 の署名付き URL を発行する
 * ボディ: { fileName: string; contentType: string; type: "icon" | "mod"; projectSlug: string }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { fileName, contentType, type, projectSlug } = body as {
    fileName:    string;
    contentType: string;
    type:        "icon" | "mod" | "avatar" | "media";
    projectSlug?: string;
  };

  if (!fileName || !contentType || !type) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (type !== "avatar" && !projectSlug) {
    return NextResponse.json({ error: "Missing projectSlug" }, { status: 400 });
  }

  // 未保存プロジェクト用の逃げ道。まだ DB にレコードが無いので所有権を確認できない。
  // 誰でも通せてしまう経路なので、
  //  1. アイコン（画像）に限定し、
  //  2. キーを呼び出し元のユーザーIDで区切って他人の領域に書けないようにする
  // という 2 点で影響範囲を閉じる。
  const isNewProject = type !== "avatar" && projectSlug === "new-project";
  if (isNewProject && type !== "icon") {
    return NextResponse.json({ error: "Invalid type for new project" }, { status: 400 });
  }

  if (type !== "avatar") {
    if (isNewProject) {
      // 上のガード済み。DBチェックはスキップする
    } else {
      const { getDatabase } = await import("@/lib/db");
      const { projectMembers } = await import("@/db/schema");
      const { eq, and } = await import("drizzle-orm");
      const { findProjectPostBySlug } = await import("@/lib/queries/post");
      const db = await getDatabase();
      const project = await findProjectPostBySlug(db, projectSlug!);

      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      const member = await db.select().from(projectMembers).where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, session.user.id))).get();
      if (project.authorId !== session.user.id && !member && session.user.role !== "admin") {
        return NextResponse.json({ error: "Forbidden: You don't have permission to upload to this project" }, { status: 403 });
      }
    }
  }

  // ファイルタイプ検証（direct アップロードと同じ定義を共有する）
  if (!isAllowedUpload(type, contentType, fileName)) {
    return NextResponse.json({ error: `Invalid file type for ${type}` }, { status: 400 });
  }

  const uniqueId = createId();
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const slugOrId = type === "avatar" ? session.user.id : projectSlug!;
  const key = isNewProject
    ? `${type}/new-project/${session.user.id}/${Date.now()}/${uniqueId}/${safeFileName}`
    : buildR2Key(type, slugOrId, `${uniqueId}/${safeFileName}`);

  // 本番: R2 の S3 互換 API で presigned URL を発行し、ブラウザ → R2 へ直接 PUT させる。
  // これによりアップロードのバイト転送が OpenNext Worker を一切通らず、Worker 負荷が発生しない。
  // クライアント側（uploadFileToR2）は PUT 先が変わるだけで無改造で動く。
  const s3Config = getR2S3Config();
  if (s3Config) {
    try {
      const uploadUrl = await createPresignedPutUrl(key, s3Config);
      return NextResponse.json({ key, uploadUrl, publicUrl: getR2PublicUrl(key) });
    } catch (err) {
      // 署名失敗時はフォールバックせず可視化する（設定ミスを黙って握りつぶさない）
      console.error("Failed to create presigned URL:", err);
      return NextResponse.json({ error: "Failed to create upload URL" }, { status: 500 });
    }
  }

  // フォールバック（開発 / S3 クレデンシャル未設定時）: Worker 経由の直接アップロード。
  return NextResponse.json({
    key,
    uploadUrl: `/api/upload/direct?key=${encodeURIComponent(key)}`,
    publicUrl: getR2PublicUrl(key),
  });
}
