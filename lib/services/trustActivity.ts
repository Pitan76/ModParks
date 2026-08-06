/**
 * 行動由来の加点 (version_clean) を台帳へ反映する。
 *
 * 公開直後には加点しない。加点目的の空アップロードが成立しないよう、
 * 公開から一定期間を無事に過ごしたバージョンだけを対象にする。
 */
import { and, eq, isNull, lt, notInArray, sql } from "drizzle-orm";
import { getDatabase } from "@/lib/db";
import { versions, projects, posts, reports } from "@/db/schema";
import { recordTrustEvent } from "./trust";

const DAY_MS = 86_400_000;

/** 公開からこの日数が経ち、無通報のままなら加点する */
export const VERSION_CLEAN_DAYS = 14;

export type CleanVersion = {
  versionId: string;
  /** アップロード実行者。取り込み前の古い行は null なので投稿者で補う */
  uploaderId: string | null;
  authorId: string;
  publishedAt: Date;
};

/**
 * 加点対象のバージョンを引く。
 *
 * 条件は「公開済みプロジェクトに属し」「スキャンで無警告」「アーカイブされておらず」
 * 「14 日が経過」「そのプロジェクトへの通報がない」こと。
 */
async function findCleanVersions(now: Date, limit: number): Promise<CleanVersion[]> {
  const db = await getDatabase();
  const threshold = new Date(now.getTime() - VERSION_CLEAN_DAYS * DAY_MS);

  const reported = db.select({ projectId: reports.projectId }).from(reports)
    .where(sql`${reports.projectId} is not null`);

  const rows = await db
    .select({
      versionId: versions.id,
      uploaderId: versions.uploaderId,
      authorId: posts.authorId,
      publishedAt: versions.createdAt,
    })
    .from(versions)
    .innerJoin(projects, eq(projects.id, versions.projectId))
    .innerJoin(posts, eq(posts.id, projects.id))
    .where(and(
      eq(versions.scanStatus, "clean"),
      isNull(versions.archivedAt),
      lt(versions.createdAt, threshold),
      eq(posts.visibility, "public"),
      notInArray(projects.id, reported),
    ))
    .limit(limit)
    .all();

  return rows;
}

/**
 * 無事に公開され続けているバージョンの分を加点する。
 *
 * 記録は (userId, kind, subjectId) で冪等なので、
 * 既に加点済みのバージョンが対象に含まれていても二重には積まれない。
 */
export async function syncVersionCleanCredits(now: Date = new Date(), limit = 500): Promise<number> {
  const candidates = await findCleanVersions(now, limit);

  let recorded = 0;
  for (const candidate of candidates) {
    const inserted = await recordTrustEvent({
      // 加点は実行者本人に入れる。uploaderId 導入前の行だけ投稿者にフォールバックする
      userId: candidate.uploaderId ?? candidate.authorId,
      kind: "version_clean",
      subjectType: "version",
      subjectId: candidate.versionId,
      // 減衰の起点は加点日ではなく公開日。古い実績は自然に薄まる
      occurredAt: candidate.publishedAt,
    });
    if (inserted) recorded += 1;
  }
  return recorded;
}
