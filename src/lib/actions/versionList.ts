"use server";

import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { projectMembers } from "@/db/schema";
import { findProjectPostBySlug } from "@/lib/queries/post";
import {
  listPublicProjectVersions,
  PROJECT_VERSIONS_PAGE_SIZE,
  type PublicProjectVersion,
} from "@/lib/queries/versionList";

/** 未公開扱いのプロジェクト。関係者以外には空を返す */
const RESTRICTED_VISIBILITIES = new Set(["draft", "private"]);

/**
 * プロジェクト詳細の「さらに読み込む」から呼ばれる、公開バージョンの続きの取得。
 *
 * Server Action は URL を知る誰でも叩けるため、ページ側と同じ公開判定をここでもう一度行う。
 */
export async function loadMoreProjectVersions(slug: string, offset: number): Promise<PublicProjectVersion[]> {
  const db = await getDatabase();

  const project = await findProjectPostBySlug(db, slug);
  if (!project) return [];

  if (RESTRICTED_VISIBILITIES.has(project.visibility)) {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return [];

    if (project.authorId !== userId) {
      const member = await db
        .select({ userId: projectMembers.userId })
        .from(projectMembers)
        .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, userId)))
        .get();
      if (!member) return [];
    }
  }

  return listPublicProjectVersions(db, project.id, {
    limit:  PROJECT_VERSIONS_PAGE_SIZE,
    offset: Math.max(0, Math.trunc(offset)),
  });
}
