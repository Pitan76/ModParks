import { getDatabase } from "@/lib/db";
import { projectMedia } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

/** 公開ページ用: 認証を要さずプロジェクトの画像を表示順で取得する */
export async function getPublicProjectMedia(projectId: string) {
  const db = await getDatabase();
  return await db
    .select()
    .from(projectMedia)
    .where(eq(projectMedia.projectId, projectId))
    .orderBy(asc(projectMedia.sortOrder))
    .all();
}
