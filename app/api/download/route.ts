import { type NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { versions, projects } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { getR2PublicUrl } from "@/lib/r2";

/** GET /api/download/[versionId]
 * - ダウンロードカウントをインクリメント
 * - R2 のファイル URL または外部URLにリダイレクト
 */
export async function GET(req: NextRequest) {
  const versionId = req.nextUrl.searchParams.get("versionId");
  if (!versionId) return NextResponse.json({ error: "Missing versionId" }, { status: 400 });

  try {
    const db = await getDatabase();

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

    if (!project || project.status === "draft") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // ダウンロードカウントをインクリメント（M-2: 重複排除 10分間）
    const rlRes = await checkRateLimit(`download:${versionId}`, 1, 10 * 60 * 1000);
    
    if (rlRes.success) {
      await Promise.all([
        db
          .update(versions)
          .set({ downloads: sql`${versions.downloads} + 1` })
          .where(eq(versions.id, versionId))
          .run(),
        db
          .update(projects)
          .set({ 
            downloads: sql`${projects.downloads} + 1`, 
            totalDownloads: sql`${projects.totalDownloads} + 1` 
          })
          .where(eq(projects.id, project.id))
          .run(),
      ]);
    }

    // 外部URLの場合はそのままリダイレクト、R2の場合はプレフィックスを付加
    const fileUrl = version.fileUrl.startsWith("http")
      ? version.fileUrl
      : getR2PublicUrl(version.fileUrl);

    return NextResponse.redirect(fileUrl, { status: 302 });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
