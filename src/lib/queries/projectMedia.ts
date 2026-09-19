import { projectMedia } from "@modparks/core/db/schema";
import type { Database } from "@modparks/core/db/client";
import { eq, asc } from "drizzle-orm";

/** 公開ページ用: 認証を要さずプロジェクトの画像を表示順で取得する */
export async function getPublicProjectMedia(db: Database, projectId: string) {
  return await db
    .select()
    .from(projectMedia)
    .where(eq(projectMedia.projectId, projectId))
    .orderBy(asc(projectMedia.sortOrder))
    .all();
}
