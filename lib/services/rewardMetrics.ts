/**
 * クリエイタ還元の日次メトリクス収集。
 *
 * projects.downloads は累積カウンタで期間差分が取れないため、
 * 配分計算に使う実測値をここで日単位に積む。
 *
 * 書き込みは重複排除を通過したイベントのみなので、
 * 件数はリクエスト数ではなくユニーク訪問者数の桁に収まる。
 */
import { sql } from "drizzle-orm";
import { getDatabase } from "@/lib/db";
import { projectMetricDaily } from "@/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";

/** 同一IPからの閲覧を 1日 1回だけ数えるための窓 */
const VIEW_DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** 閲覧者の区分。プレミアム購読の導入時にここを実装へ差し替える */
export type ViewerTier = "free" | "premium";

/** UTC 基準の epoch day */
function toEpochDay(at: Date = new Date()): number {
  return Math.floor(at.getTime() / 86_400_000);
}

/**
 * 閲覧者の区分を解決する。
 * プレミアム購読が未実装の間は全員 free 扱いで、広告プールの配分対象になる。
 */
export function resolveViewerTier(): ViewerTier {
  return "free";
}

/**
 * 日次メトリクスに 1 件加算する。
 * 集計の失敗でページ表示やダウンロードを巻き戻さないよう、呼び出し側で例外を握る。
 */
async function incrementMetric(
  projectId: string,
  column: "pageViews" | "downloads",
  tier: ViewerTier
): Promise<void> {
  const db = await getDatabase();
  const date = toEpochDay();
  const isView = column === "pageViews";

  await db
    .insert(projectMetricDaily)
    .values({
      projectId,
      date,
      viewerTier: tier,
      pageViews: isView ? 1 : 0,
      downloads: isView ? 0 : 1,
    })
    .onConflictDoUpdate({
      target: [projectMetricDaily.projectId, projectMetricDaily.date, projectMetricDaily.viewerTier],
      set: isView
        ? { pageViews: sql`${projectMetricDaily.pageViews} + 1` }
        : { downloads: sql`${projectMetricDaily.downloads} + 1` },
    })
    .run();
}

/**
 * プロジェクトページの閲覧を記録する。
 *
 * 作者・メンバー・管理者の閲覧は自演を配分に反映させないため数えない。
 * 同一IPからは 1日 1回のみ計上する。
 *
 * レスポンス後の after() から呼ばれるため、headers() を読めない。
 * IP はレンダリング中に解決したものを受け取る。
 */
export async function recordProjectView(projectId: string, isInsider: boolean, clientIp: string): Promise<void> {
  if (isInsider) return;

  try {
    const dedupe = await checkRateLimit(`rwview:${projectId}`, 1, VIEW_DEDUPE_WINDOW_MS, undefined, clientIp);
    if (!dedupe.success) return;

    await incrementMetric(projectId, "pageViews", resolveViewerTier());
  } catch (err) {
    console.error("[REWARD] Failed to record project view:", (err as Error)?.message, err);
  }
}

/**
 * ダウンロードを記録する。
 *
 * 呼び出し側で既存のダウンロードカウンタと同じ重複排除を通しているため、
 * ここでは追加の除外判定を行わない。
 */
export async function recordProjectDownload(projectId: string): Promise<void> {
  try {
    await incrementMetric(projectId, "downloads", resolveViewerTier());
  } catch (err) {
    console.error("[REWARD] Failed to record project download:", err);
  }
}
