"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { userSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createId } from "@paralleldrive/cuid2";
import { fetchCfProject, projectContainsCode } from "@/lib/curseforge";

const CODE_PREFIX = "modparks-verify-";

export type CfVerifyResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * 所有確認コードを発行し、対象プロジェクトIDとともに保存する。
 * ユーザーはこのコードを CurseForge プロジェクトの公開フィールドに記載する。
 */
export async function startCfVerification(projectId: string): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const { db, userId } = await getAuthenticatedDb();
  const ref = projectId.trim();
  if (!ref) return { ok: false, error: "projectIdRequired" };

  const code = CODE_PREFIX + createId();
  await db.update(userSettings).set({
    curseforgeProjectId: ref,
    curseforgeVerifyCode: code,
    curseforgeVerifiedAt: null,
    curseforgeAuthorId: null,
  }).where(eq(userSettings.userId, userId));

  revalidatePath("/settings");
  return { ok: true, code };
}

/**
 * プロジェクトの公開フィールドに確認コードが記載されているかを検証し、
 * 一致すればその作者IDを所有確認済みとして保存する。
 */
export async function confirmCfVerification(): Promise<CfVerifyResult> {
  const { db, userId } = await getAuthenticatedDb();

  const settings = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).get();
  if (!settings?.curseforgeProjectId || !settings.curseforgeVerifyCode) {
    return { ok: false, error: "notStarted" };
  }

  const project = await fetchCfProject(settings.curseforgeProjectId);
  if (!project) return { ok: false, error: "projectNotFound" };
  if (!projectContainsCode(project, settings.curseforgeVerifyCode)) {
    return { ok: false, error: "codeNotFound" };
  }

  const authorId = project.authors?.[0]?.id;
  if (!authorId) return { ok: false, error: "noAuthor" };

  await db.update(userSettings).set({
    curseforgeAuthorId: authorId.toString(),
    curseforgeVerifiedAt: new Date(),
    curseforgeVerifyCode: null,
  }).where(eq(userSettings.userId, userId));

  revalidatePath("/settings");
  return { ok: true };
}
