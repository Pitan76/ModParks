"use server";

import * as core from "@modparks/core/versions/manage";
import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { nextScanContext } from "@/lib/actions/versionScan";
import { nextSystemCommentMessage } from "@/lib/notifications/notify";
import { getServerErrors } from "@/lib/i18n/serverErrors";
import { assertFeatureEnabled } from "@/lib/runtime/guard";
import type { Database } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

// 再エクスポートは置かない。"use server" ファイルは値を再公開できず、型を再公開すると
// サーバー専用モジュールがクライアントバンドルへ引き込まれるため、呼び出し側は
// deleteVersion / setVersionArchived を @/lib/actions/versionLifecycle から、
// ExternalUploadSummary を @/lib/externalSync/uploadSummary から直接 import する。

async function versionDeps(db: Database): Promise<core.VersionDeps> {
  return {
    scan: await nextScanContext(db),
    t: await getServerErrors(),
    systemComment: nextSystemCommentMessage,
    defer: (task) => after(task),
  };
}

function revalidateVersionPages(projectSlug: string, ideaId: FormDataEntryValue | null) {
  revalidatePath(`/projects/${projectSlug}`);
  revalidatePath(`/ideas`);
  if (typeof ideaId === "string" && ideaId) revalidatePath(`/ideas/${ideaId}`);
}

/**
 * プロジェクトに対する新しいバージョン（ファイル）を登録する Server Action。本体は core/versions/manage.ts。
 */
export const createVersion = async (projectSlug: string, formData: FormData) => {
  await assertFeatureEnabled("upload");
  const { db, session } = await getAuthenticatedDb();

  const result = await core.createVersion(await versionDeps(db), session.user.id, projectSlug, formData);
  if ("success" in result) revalidateVersionPages(projectSlug, formData.get("ideaId"));

  return result;
};

/**
 * プロジェクトのバージョン情報を更新する Server Action。本体は core/versions/manage.ts。
 */
export const updateVersion = async (versionId: string, projectSlug: string, formData: FormData) => {
  const { db, session } = await getAuthenticatedDb();

  const result = await core.updateVersion(await versionDeps(db), session.user.id, versionId, projectSlug, formData);
  if ("success" in result) revalidateVersionPages(projectSlug, formData.get("ideaId"));

  return result;
};
