import { type NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { versions, projects, projectMembers, users } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { getR2PublicUrl } from "@/lib/r2";
import { auth } from "@/lib/auth";
import { validateApiKey } from "@/lib/api-auth";

/** 未公開扱いのステータス（直リンクでも認可が必要） */
const RESTRICTED_STATUSES = new Set(["draft", "private"]);

/**
 * ダウンロード要求元のユーザーID（セッション or APIキー）を解決する。
 * どちらも無ければ null。
 */
async function resolveRequesterId(req: NextRequest): Promise<string | null> {
  const session = await auth();
  if (session?.user?.id) return session.user.id;

  const apiAuth = await validateApiKey(req);
  if (apiAuth.valid && apiAuth.userId) return apiAuth.userId;

  return null;
}

/**
 * 未公開プロジェクトのファイルにアクセスできるのは、作者・メンバー・管理者のみ。
 */
async function canAccessRestricted(
  db: Awaited<ReturnType<typeof getDatabase>>,
  project: { id: string; authorId: string },
  userId: string | null
): Promise<boolean> {
  if (!userId) return false;
  if (project.authorId === userId) return true;

  const dbUser = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).get();
  if (dbUser?.role === "admin") return true;

  const member = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, userId)))
    .get();

  return !!member;
}

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

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // 未公開（draft/private）は作者・メンバー・管理者のみアクセス可。
    // public / unlisted は直リンクで誰でもダウンロードできる。
    if (RESTRICTED_STATUSES.has(project.status)) {
      const requesterId = await resolveRequesterId(req);
      if (!(await canAccessRestricted(db, project, requesterId))) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
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
