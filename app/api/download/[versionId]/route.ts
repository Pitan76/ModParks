import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/** GET /api/download/[versionId]
 * - ダウンロードカウントをインクリメント
 * - R2 のファイル URL にリダイレクト
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  const { versionId } = await params;

  try {
    // Cloudflare Workers バインディングから DB を取得
    const env = process.env as unknown as { DB: D1Database };

    if (!env.DB) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      );
    }

    const { getDb } = await import("@/lib/db");
    const { versions, projects } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    const db = getDb(env.DB);

    // バージョンを取得
    const version = await db
      .select()
      .from(versions)
      .where(eq(versions.id, versionId))
      .get();

    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    // プロジェクトが公開されているか確認
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, version.projectId))
      .get();

    if (!project || project.status !== "published") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // ダウンロードカウントをインクリメント
    await Promise.all([
      db
        .update(versions)
        .set({ downloads: version.downloads + 1 })
        .where(eq(versions.id, versionId))
        .run(),
      db
        .update(projects)
        .set({ downloads: project.downloads + 1 })
        .where(eq(projects.id, project.id))
        .run(),
    ]);

    // R2 ファイルへリダイレクト
    const fileUrl = version.fileUrl.startsWith("http")
      ? version.fileUrl
      : `${process.env.R2_PUBLIC_URL}/${version.fileUrl}`;

    return NextResponse.redirect(fileUrl, { status: 302 });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
