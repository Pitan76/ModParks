import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildR2Key } from "@/lib/r2";
import { createId } from "@paralleldrive/cuid2";

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
    type:        "icon" | "mod";
    projectSlug: string;
  };

  if (!fileName || !contentType || !type || !projectSlug) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // ファイルタイプ検証
  const ALLOWED_MOD_TYPES  = ["application/java-archive", "application/zip", "application/octet-stream"];
  const ALLOWED_ICON_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

  if (type === "mod" && !ALLOWED_MOD_TYPES.includes(contentType)) {
    return NextResponse.json({ error: "Invalid file type for mod" }, { status: 400 });
  }
  if (type === "icon" && !ALLOWED_ICON_TYPES.includes(contentType)) {
    return NextResponse.json({ error: "Invalid file type for icon" }, { status: 400 });
  }

  const uniqueId = createId();
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = buildR2Key(type, projectSlug, `${uniqueId}_${safeFileName}`);

  // 開発環境では署名付きURLの代わりに直接アップロードURLを返す
  // 本番: Cloudflare Workers の R2 バインディングから createPresignedUrl を使用
  return NextResponse.json({
    key,
    uploadUrl: `/api/upload/direct?key=${encodeURIComponent(key)}`,
    publicUrl: `${process.env.R2_PUBLIC_URL ?? ""}/${key}`,
  });
}
