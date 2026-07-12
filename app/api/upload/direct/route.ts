import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadToR2, getR2Bucket } from "@/lib/r2";

/** PUT /api/upload/direct
 * 開発環境向けの R2 への直接アップロードエンドポイント
 * (本番環境ではS3互換のPresigned URLを返す設計の場合、このエンドポイントは不要ですが、
 * Cloudflare Workers R2バインディングではPresigned URL発行が複雑なため、
 * ワーカー経由で直接ファイルをPUTするエンドポイントとしても利用されます)
 */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  // Key validation (H-1)
  const allowedPrefixes = [
    `avatar/${session.user.id}/`,
    `icon/`,
    `mod/`
  ];
  const isAllowedPrefix = allowedPrefixes.some(prefix => key.startsWith(prefix));
  if (!isAllowedPrefix) {
    return NextResponse.json({ error: "Forbidden: Invalid key prefix" }, { status: 403 });
  }

  if (key.startsWith("icon/") || key.startsWith("mod/")) {
    const parts = key.split("/");
    if (parts.length < 3) {
      return NextResponse.json({ error: "Forbidden: Invalid key format" }, { status: 403 });
    }
    const slugOrId = parts[1];
    
    if (slugOrId !== "new-project") {
      const { getDb, getD1 } = await import("@/lib/db");
      const { projects, projectMembers } = await import("@/db/schema");
      const { eq, and } = await import("drizzle-orm");
      const d1 = await getD1();
      const db = getDb(d1);
      const project = await db.select().from(projects).where(eq(projects.slug, slugOrId)).get();
      
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      const member = await db.select().from(projectMembers).where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, session.user.id))).get();
      if (project.authorId !== session.user.id && !member && session.user.role !== "admin") {
        return NextResponse.json({ error: "Forbidden: You don't have permission to upload to this project" }, { status: 403 });
      }
    }
  }

  let R2: R2Bucket;
  try {
    R2 = await getR2Bucket();
  } catch {
    return NextResponse.json({ error: "R2 binding not found" }, { status: 500 });
  }

  try {
    const contentLengthStr = req.headers.get("content-length");
    const contentLength = contentLengthStr ? parseInt(contentLengthStr, 10) : 0;
    
    if (contentLength > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds 5MB limit" }, { status: 413 });
    }

    const contentType = req.headers.get("content-type") || "application/octet-stream";
    
    if (!req.body) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    await uploadToR2(R2, key, req.body, contentType);

    return NextResponse.json({ success: true, key });
  } catch (err: any) {
    console.error("Upload Error:", err);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
