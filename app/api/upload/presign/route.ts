import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildR2Key, getR2PublicUrl } from "@/lib/r2";
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
    type:        "icon" | "mod" | "avatar";
    projectSlug?: string;
  };

  if (!fileName || !contentType || !type) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (type !== "avatar" && !projectSlug) {
    return NextResponse.json({ error: "Missing projectSlug" }, { status: 400 });
  }

  if (type !== "avatar") {
    if (projectSlug === "new-project") {
      // プロジェクト新規作成時はDBチェックをスキップする
    } else {
      const { getDatabase } = await import("@/lib/db");
      const { projects, projectMembers } = await import("@/db/schema");
      const { eq, and } = await import("drizzle-orm");
      const db = await getDatabase();
      const project = await db.select().from(projects).where(eq(projects.slug, projectSlug!)).get();
      
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      const member = await db.select().from(projectMembers).where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, session.user.id))).get();
      if (project.authorId !== session.user.id && !member && session.user.role !== "admin") {
        return NextResponse.json({ error: "Forbidden: You don't have permission to upload to this project" }, { status: 403 });
      }
    }
  }

  // ファイルタイプ検証
  const ALLOWED_MOD_TYPES  = [
    "application/java-archive",
    "application/x-java-archive",
    "application/zip",
    "application/x-zip-compressed",
    "application/octet-stream"
  ];
  const ALLOWED_ICON_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

  const isAllowedModExtension = fileName.endsWith(".jar") || fileName.endsWith(".zip");

  if (type === "mod" && !ALLOWED_MOD_TYPES.includes(contentType) && !isAllowedModExtension) {
    return NextResponse.json({ error: "Invalid file type for mod" }, { status: 400 });
  }
  if ((type === "icon" || type === "avatar") && !ALLOWED_ICON_TYPES.includes(contentType)) {
    return NextResponse.json({ error: `Invalid file type for ${type}` }, { status: 400 });
  }

  const uniqueId = createId();
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const slugOrId = type === "avatar" ? session.user.id : projectSlug!;
  const key = buildR2Key(type, slugOrId, `${uniqueId}/${safeFileName}`);

  // 開発環境では署名付きURLの代わりに直接アップロードURLを返す
  // 本番: Cloudflare Workers の R2 バインディングから createPresignedUrl を使用
  return NextResponse.json({
    key,
    uploadUrl: `/api/upload/direct?key=${encodeURIComponent(key)}`,
    publicUrl: getR2PublicUrl(key),
  });
}
