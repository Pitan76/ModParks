"use server";

import { getAuthenticatedDb, getAdminDb } from "@/lib/auth-helpers";
import { reports, posts, projects, users, userProfiles, comments, ideas } from "@/db/schema";
import { createReportSchema } from "@/lib/validations";
import { createId } from "@paralleldrive/cuid2";
import { count, eq, desc, or } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { revalidatePath } from "next/cache";
import { recordModerationAudit } from "@/lib/actions/moderationAudit";
import { toggleUserSuspension } from "@/lib/actions/admin/users";
import type { Database } from "@/lib/db";

/**
 * ユーザーがプロジェクトを通報する Server Action
 * @param projectId 通報対象のプロジェクトID
 * @param formData フォームデータ (reason, detail)
 * @returns { success: boolean } または { error: Record<string, string[]> }
 * @throws Unauthorized ログインしていない場合
 */
export async function createReport(
  targetType: "project" | "idea" | "comment" | "user",
  targetId: string,
  formData: FormData
) {
  const { db, userId } = await getAuthenticatedDb();

  const raw = {
    reason: formData.get("reason"),
    detail: formData.get("detail"),
  };

  const parsed = createReportSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const id = createId();

  await db.insert(reports).values({
    id,
    reason:     parsed.data.reason,
    detail:     parsed.data.detail || null,
    reporterId: userId,
    targetType,
    projectId:  targetType === "project" ? targetId : null,
    ideaId:     targetType === "idea" ? targetId : null,
    commentId:  targetType === "comment" ? targetId : null,
    userId:     targetType === "user" ? targetId : null,
  }).run();

  await notifyNewReport(db);
  return { success: true };
}

/**
 * 通報が入ったことを管理者へ即時に知らせる。
 *
 * 通報だけでは何も自動で起きないため、気づかれないと放置される。
 * 通知の失敗で通報そのものを失敗させたくないので、ここで握る。
 */
async function notifyNewReport(db: Database) {
  try {
    const [{ getAdminWebhookUrl }, { buildReportQueueEmbed, sendTrustAlert }] = await Promise.all([
      import("@/lib/usage/webhook"),
      import("@/lib/services/trustAlert"),
    ]);

    const pending = await db
      .select({ total: count() })
      .from(reports)
      .where(eq(reports.status, "pending"))
      .get();

    await sendTrustAlert(await getAdminWebhookUrl(), buildReportQueueEmbed({
      pending: Number(pending?.total ?? 1),
      reminder: false,
    }));
  } catch (e) {
    console.error("Failed to notify new report:", e);
  }
}

// ---- 管理者: 通報ステータス更新 ----

/**
 * 通報の処理結果を信頼ポイントへ反映する。
 * 信頼ポイントの記録が失敗しても通報の処理自体は成立させたいので、ここで握る。
 */
async function applyReportTrust(
  report: typeof reports.$inferSelect,
  status: "resolved" | "dismissed",
  penalizeReporter: boolean
) {
  try {
    const trust = await import("@/lib/services/trustModeration");
    if (status === "resolved") {
      await trust.applyReportUpheld(report);
      return;
    }
    await trust.applyReportRejected(report, { penalizeReporter });
  } catch (e) {
    console.error("Failed to apply trust events for report:", report.id, e);
  }
}

/**
 * 管理者が通報のステータスを更新する Server Action
 * @param reportId 対象の通報ID
 * @param status 変更後のステータス ("resolved" または "dismissed")
 * @returns { success: boolean }
 * @throws Forbidden 管理者権限がない場合
 */
export async function updateReportStatus(
  reportId: string,
  status: "resolved" | "dismissed",
  _formData?: FormData,
  /** 却下時に通報者を減点するか。既定は減点しない（→ memo/TRUST_CREDIT.md 3.2） */
  penalizeReporter = false
) {
  const { db, userId } = await getAdminDb();

  const report = await db.select().from(reports).where(eq(reports.id, reportId)).get();
  if (!report) return { success: false };

  await db
    .update(reports)
    .set({ status })
    .where(eq(reports.id, reportId))
    .run();

  await applyReportTrust(report, status, penalizeReporter);

  await recordModerationAudit(
    db,
    status === "resolved" ? "report_resolve" : "report_dismiss",
    reportId,
    userId
  );

  revalidatePath("/admin/reports");
  return { success: true };
}

// ---- 管理者: プロジェクト非公開 ----

/**
 * 管理者が問題のあるプロジェクト/アイデアを非公開(draft)にする Server Action
 * @param postId 対象の投稿ID
 * @returns { success: boolean }
 * @throws Forbidden 管理者権限がない場合
 */
export async function unpublishProject(postId: string, _formData?: FormData) {
  const { db, userId } = await getAdminDb();

  // 公開範囲は posts が持つ。Idea も同じ経路で非公開にできる
  await db
    .update(posts)
    .set({ visibility: "draft", updatedAt: new Date() })
    .where(eq(posts.id, postId))
    .run();

  await recordModerationAudit(db, "post_unpublish", postId, userId);

  revalidatePath("/admin/reports");
  revalidatePath("/projects");
  return { success: true };
}

/**
 * 管理者が問題のあるコメントを削除する Server Action
 * @param commentId 対象のコメントID
 * @returns { success: boolean }
 * @throws Forbidden 管理者権限がない場合
 */
export async function deleteCommentAction(commentId: string, _formData?: FormData) {
  const { db, userId } = await getAdminDb();

  await db.delete(comments).where(eq(comments.id, commentId)).run();

  await recordModerationAudit(db, "report_resolve", commentId, userId);

  revalidatePath("/admin/reports");
  return { success: true };
}

/**
 * 管理者が通報されたユーザーを凍結する Server Action
 * @param targetUserId 対象のユーザーID
 * @returns { success: boolean }
 * @throws Forbidden 管理者権限がない場合
 */
export async function suspendUserFromReport(targetUserId: string, _formData?: FormData) {
  const { db } = await getAdminDb();

  const user = await db.select().from(users).where(eq(users.id, targetUserId)).get();
  if (user && !user.suspendedAt) {
    await toggleUserSuspension(targetUserId);
  }

  revalidatePath("/admin/reports");
  return { success: true };
}

// ---- 管理者: 通報一覧取得 ----

/**
 * 管理者向け: すべての通報一覧を取得する Server Action
 * @returns 通報データ(report)と、対象プロジェクト(project)、通報者(reporter)の結合配列
 * @throws Forbidden 管理者権限がない場合
 */
export async function getReports() {
  const { db } = await getAdminDb();

  const reportedUser = alias(users, "reported_user");
  const reportedUserProfile = alias(userProfiles, "reported_user_profile");
  const reporter = alias(users, "reporter");
  const reporterProfile = alias(userProfiles, "reporter_profile");
  const commentParentPost = alias(posts, "comment_parent_post");

  return await db
    .select({
      report: reports,
      project: {
        id: posts.id,
        slug: posts.slug,
        name: posts.title,
      },
      idea: {
        id: posts.id,
        slug: posts.slug,
        name: posts.title,
      },
      comment: {
        id: comments.id,
        content: comments.content,
        postId: comments.postId,
        postKind: commentParentPost.kind,
        postSlug: commentParentPost.slug,
        postTitle: commentParentPost.title,
      },
      reportedUser: {
        id: reportedUser.id,
        username: reportedUserProfile.username,
        displayName: reportedUserProfile.displayName,
      },
      reporter: {
        username: reporterProfile.username,
        displayName: reporterProfile.displayName,
      }
    })
    .from(reports)
    .leftJoin(posts, or(eq(reports.projectId, posts.id), eq(reports.ideaId, posts.id)))
    .leftJoin(comments, eq(reports.commentId, comments.id))
    .leftJoin(commentParentPost, eq(comments.postId, commentParentPost.id))
    .leftJoin(reportedUser, eq(reports.userId, reportedUser.id))
    .leftJoin(reportedUserProfile, eq(reportedUser.id, reportedUserProfile.userId))
    .innerJoin(reporter, eq(reports.reporterId, reporter.id))
    .leftJoin(reporterProfile, eq(reporter.id, reporterProfile.userId))
    .orderBy(desc(reports.createdAt))
    .all();
}
