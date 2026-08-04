/**
 * 管理画面のスキャンログ。
 *
 * jar 検査は判定をバージョン行（versions.scan_*）に持つだけで一覧できる場所が無く、
 * 「何がスキャンされ、どう判定されたか」を後から追えなかった。ここで横断的に引く。
 */
import { getDatabase } from "@/lib/db";
import { versions, projects, posts, scanAppeals } from "@/db/schema";
import { and, count, desc, eq, isNotNull, sql } from "drizzle-orm";

/** 一覧のフィルタ。"all" は未スキャンや対象外も含めた全件 */
export type ScanLogFilter = "all" | "pending" | "clean" | "suspicious" | "malicious" | "skipped";

export const SCAN_LOG_PAGE_SIZE = 50;

export type ScanLogRow = {
  versionId: string;
  versionNumber: string;
  scanStatus: string;
  scanFindings: string | null;
  scanAt: Date | null;
  fileName: string;
  fileSha256: string | null;
  archivedAt: Date | null;
  projectSlug: string;
  projectName: string;
  /** このバージョンに紐づく異議申請の状態。無ければ null */
  appealStatus: string | null;
};

/**
 * スキャン結果の一覧。新しい順（未スキャンは scanAt が無いので作成順で後ろに寄る）。
 */
export async function getScanLogs(filter: ScanLogFilter, page: number): Promise<ScanLogRow[]> {
  const db = await getDatabase();

  const query = db
    .select({
      versionId: versions.id,
      versionNumber: versions.versionNumber,
      scanStatus: versions.scanStatus,
      scanFindings: versions.scanFindings,
      scanAt: versions.scanAt,
      fileName: versions.fileName,
      fileSha256: versions.fileSha256,
      archivedAt: versions.archivedAt,
      projectSlug: posts.slug,
      projectName: posts.title,
      appealStatus: scanAppeals.status,
    })
    .from(versions)
    .innerJoin(projects, eq(versions.projectId, projects.id))
    .innerJoin(posts, eq(posts.id, projects.id))
    .leftJoin(scanAppeals, eq(scanAppeals.versionId, versions.id))
    .orderBy(desc(versions.scanAt), desc(versions.createdAt))
    .limit(SCAN_LOG_PAGE_SIZE)
    .offset(Math.max(0, page - 1) * SCAN_LOG_PAGE_SIZE);

  if (filter === "all") return query.all();
  return query.where(eq(versions.scanStatus, filter)).all();
}

/** ステータスごとの件数。タブのバッジと総ページ数に使う */
export async function getScanLogCounts(): Promise<Record<string, number>> {
  const db = await getDatabase();

  const rows = await db
    .select({ status: versions.scanStatus, count: count() })
    .from(versions)
    .groupBy(versions.scanStatus)
    .all();

  const counts: Record<string, number> = { pending: 0, clean: 0, suspicious: 0, malicious: 0, skipped: 0, all: 0 };
  for (const row of rows) {
    counts[row.status] = row.count;
    counts.all += row.count;
  }
  return counts;
}

/**
 * 直近の検出内容の集計。どのルールがよく当たっているか（＝誤検知の温床か）を見るためのもの。
 */
export async function getTopScanFindings(limit = 10) {
  const db = await getDatabase();

  const rows = await db
    .select({ findings: versions.scanFindings })
    .from(versions)
    .where(and(isNotNull(versions.scanFindings), sql`${versions.scanFindings} != '[]'`))
    .orderBy(desc(versions.scanAt))
    .limit(500)
    .all();

  const tally = new Map<string, number>();
  for (const row of rows) {
    for (const rule of parseRules(row.findings)) tally.set(rule, (tally.get(rule) ?? 0) + 1);
  }

  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([rule, hits]) => ({ rule, hits }));
}

/** scan_findings は JSON 文字列。壊れていても集計を止めない */
function parseRules(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((f) => String(f?.rule ?? "unknown"));
  } catch {
    return [];
  }
}
