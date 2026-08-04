import { and, desc, eq } from "drizzle-orm";
import { getDatabase } from "@/lib/db";
import { posts, versions } from "@/db/schema";
import { normalizeReleaseChannel } from "@/lib/releaseChannels";
import type { PreviousVersionSettings } from "@/components/project/PreviousVersionSettings";

function parseJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

/**
 * 新バージョンのフォームに流用するため、プロジェクトの最新バージョンの
 * 対応MCバージョン・ローダー・リリースチャネルを取り出す。
 */
export async function getPreviousVersionSettings(slug: string): Promise<PreviousVersionSettings | null> {
  const db = await getDatabase();
  const row = await db
    .select({
      versionNumber: versions.versionNumber,
      mcVersions: versions.mcVersions,
      loaders: versions.loaders,
      releaseChannel: versions.releaseChannel,
    })
    .from(versions)
    .innerJoin(posts, eq(posts.id, versions.projectId))
    .where(and(eq(posts.kind, "project"), eq(posts.slug, slug)))
    .orderBy(desc(versions.createdAt))
    .limit(1)
    .get();

  if (!row) return null;

  return {
    versionNumber: row.versionNumber,
    mcVersions: parseJsonArray(row.mcVersions),
    loaders: parseJsonArray(row.loaders),
    releaseChannel: normalizeReleaseChannel(row.releaseChannel),
  };
}
