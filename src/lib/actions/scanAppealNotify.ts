import { versions, posts, projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notifyToUser } from "@/lib/notifications/notify";
import type { Database } from "@/lib/db";
import { APPEAL_DECISION_LABELS, NO_REVIEW_NOTE, scanStatusLabel } from "@/lib/notifications/scanLabels";

/**
 * 異議申請の裁定・スキャン判定の通知。
 *
 * 通知に必要な項目は posts（タイトル・slug・作者）と projects（アイコン）と
 * versions（バージョン番号）に分かれているため、取得を 1 箇所にまとめる。
 * 通知の失敗は裁定そのものを巻き戻す理由にならないので、ここで握って記録だけ残す。
 */

/** 通知本文に必要な、バージョンとその所属プロジェクトの情報 */
async function findNotifyTarget(db: Database, versionId: string) {
  return db
    .select({
      authorId: posts.authorId,
      projectName: posts.title,
      projectSlug: posts.slug,
      iconUrl: projects.iconUrl,
      versionNumber: versions.versionNumber,
    })
    .from(versions)
    .innerJoin(projects, eq(versions.projectId, projects.id))
    .innerJoin(posts, eq(posts.id, projects.id))
    .where(eq(versions.id, versionId))
    .get();
}

/**
 * 異議申請の裁定結果を申請者へ通知する。
 * @param appellantId 申請者のユーザーID
 */
export async function notifyAppealResult(
  db: Database,
  versionId: string,
  appellantId: string,
  decision: "approved" | "rejected",
  reviewNote: string | null,
): Promise<void> {
  try {
    const target = await findNotifyTarget(db, versionId);
    if (!target) return;

    await notifyToUser(db, appellantId, "system", "scan_appeal_result", {
      projectName: target.projectName,
      slug: target.projectSlug,
      versionNumber: target.versionNumber,
      versionId,
      statusLabel: APPEAL_DECISION_LABELS[decision],
      reviewNote: reviewNote || NO_REVIEW_NOTE,
      iconUrl: target.iconUrl || "",
    });
  } catch (err) {
    console.error("Failed to send appeal review notification:", err);
  }
}

/**
 * 手動でスキャン判定を異常側へ変えたことを、プロジェクト作者へ通知する。
 * 正常化（clean）は作者が困らないので通知しない。
 */
export async function notifyScanStatusChanged(
  db: Database,
  versionId: string,
  status: "suspicious" | "malicious",
): Promise<void> {
  try {
    const target = await findNotifyTarget(db, versionId);
    if (!target) return;

    await notifyToUser(db, target.authorId, "system", "scan_result", {
      projectName: target.projectName,
      slug: target.projectSlug,
      versionNumber: target.versionNumber,
      versionId,
      statusLabel: scanStatusLabel(status),
      iconUrl: target.iconUrl || "",
    });
  } catch (err) {
    console.error("Failed to send scan override notice:", err);
  }
}
