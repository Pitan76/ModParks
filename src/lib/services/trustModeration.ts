/**
 * モデレーションの結果を信頼ポイントへ反映する。
 *
 * 減点は即時に積むが、**自動で積むのは事実が確定したものだけ**にしている。
 * 通報の却下で通報者を減点するかどうかは管理者の判断なので、既定では何もしない。
 */
import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/lib/db";
import { comments, posts, projects, trustEvents, users, userProfiles, versions, type Report } from "@/db/schema";
import { getTrustState, recordMalwareDetected, recordTrustEvent, reverseTrustEvent } from "./trust";

/** 通報対象の持ち主を引く。持ち主が特定できない通報は減点の対象にしない */
async function findReportedOwnerId(report: Report): Promise<string | null> {
  const db = await getDatabase();

  if (report.commentId) {
    const comment = await db
      .select({ authorId: comments.authorId })
      .from(comments)
      .where(eq(comments.id, report.commentId))
      .get();
    return comment?.authorId ?? null;
  }

  const postId = report.projectId ?? report.ideaId;
  if (postId) {
    const post = await db
      .select({ authorId: posts.authorId })
      .from(posts)
      .where(eq(posts.id, postId))
      .get();
    return post?.authorId ?? null;
  }

  return report.userId;
}

export type ReportResolution = {
  /** 却下時に通報者を減点するか。既定は false（却下と悪質は別物として扱う） */
  penalizeReporter?: boolean;
  actorEmail?: string;
};

/**
 * 通報の承認を反映する。
 * 通報者に加点し、通報された側に減点を積む。
 */
export async function applyReportUpheld(report: Report, actorEmail?: string): Promise<void> {
  await recordTrustEvent({
    userId: report.reporterId,
    kind: "report_upheld",
    subjectType: "report",
    subjectId: report.id,
    actorEmail,
  });

  const ownerId = await findReportedOwnerId(report);
  if (!ownerId) return;

  await recordTrustEvent({
    userId: ownerId,
    kind: "report_upheld_against",
    subjectType: "report",
    subjectId: report.id,
    actorEmail,
  });
}

/**
 * 通報の却下を反映する。
 *
 * **既定では何も積まない。** 善意で通報して外れただけなら正常な利用であり、
 * 自動で罰すると通報をためらわせてモデレーションの目が減る。
 * 明確に悪質な場合だけ、管理者が明示的に減点を選ぶ。
 */
export async function applyReportRejected(
  report: Report,
  options: ReportResolution = {},
): Promise<void> {
  if (!options.penalizeReporter) return;

  await recordTrustEvent({
    userId: report.reporterId,
    kind: "report_rejected",
    subjectType: "report",
    subjectId: report.id,
    actorEmail: options.actorEmail,
  });
}

/**
 * 減点を入れる相手。**アップロードを実行した本人**であって、プロジェクトの持ち主ではない。
 * uploaderId 導入前に作られた行だけ、投稿者にフォールバックする。
 */
async function findVersionUploaderId(versionId: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db
    .select({ uploaderId: versions.uploaderId, authorId: posts.authorId })
    .from(versions)
    .innerJoin(projects, eq(projects.id, versions.projectId))
    .innerJoin(posts, eq(posts.id, projects.id))
    .where(eq(versions.id, versionId))
    .get();

  return row?.uploaderId ?? row?.authorId ?? null;
}

/**
 * スキャンの確定検知を反映する。
 *
 * malicious 以外では何もしない。ヒューリスティック警告 (suspicious) は
 * 「審査に回す理由」であって減点の理由ではない。
 * 誤検知はありうるので、管理者が判定を覆したときは打ち消しイベントで戻す。
 */
export async function applyScanMalicious(versionId: string, reason: string): Promise<boolean> {
  const uploaderId = await findVersionUploaderId(versionId);
  if (!uploaderId) return false;

  const { score } = await getTrustState(uploaderId);
  const recorded = await recordMalwareDetected(uploaderId, versionId, reason);
  if (recorded) await notifyMalware(uploaderId, versionId, score);
  return recorded;
}

/**
 * 確定検知を管理者へ知らせる。
 * 誤検知でも重い処分になるため、人の目に入らないまま放置されないようにする。
 */
async function notifyMalware(userId: string, versionId: string, previousScore: number): Promise<void> {
  const db = await getDatabase();
  const target = await db
    .select({ projectName: posts.title, username: userProfiles.username, email: users.email })
    .from(versions)
    .innerJoin(projects, eq(projects.id, versions.projectId))
    .innerJoin(posts, eq(posts.id, projects.id))
    .leftJoin(userProfiles, eq(userProfiles.userId, userId))
    .leftJoin(users, eq(users.id, userId))
    .where(eq(versions.id, versionId))
    .get();

  const { getAdminWebhookUrl } = await import("@/lib/usage/webhook");
  const { buildMalwareEmbed, sendTrustAlert } = await import("./trustAlert");

  await sendTrustAlert(await getAdminWebhookUrl(), buildMalwareEmbed({
    userId,
    userLabel: target?.username ?? target?.email ?? userId,
    versionId,
    projectName: target?.projectName ?? "-",
    delta: -previousScore,
  }));
}

/**
 * 確定検知が覆ったときに、積んだ減点を取り消す。
 *
 * スコアを直接戻さず打ち消しイベントを積むので、
 * 「検知されたが誤りだった」経緯が台帳に残る。
 */
export async function applyScanCleared(
  versionId: string,
  reason: string,
  actorEmail?: string,
): Promise<boolean> {
  const db = await getDatabase();
  const detected = await db
    .select({ id: trustEvents.id, userId: trustEvents.userId })
    .from(trustEvents)
    .where(and(
      eq(trustEvents.kind, "malware_detected"),
      eq(trustEvents.subjectId, versionId),
    ))
    .get();

  if (!detected) return false;

  const reversed = await reverseTrustEvent(detected.id, reason, actorEmail ?? "system");
  if (!reversed) return false;

  await recordTrustEvent({
    userId: detected.userId,
    kind: "appeal_upheld",
    subjectType: "version",
    subjectId: versionId,
    reason,
    actorEmail,
  });
  return true;
}
