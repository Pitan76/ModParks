"use server";

import * as core from "@modparks/core/versions/lifecycle";
import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { getR2Bucket } from "@/lib/r2";
import { getServerErrors } from "@/lib/i18n/serverErrors";
import { isActionError, type ActionResult } from "@modparks/core/actionResult";
import { revalidatePath } from "next/cache";

/** 本体は core/versions/lifecycle.ts */
async function lifecycleDeps() {
  const { db, session } = await getAuthenticatedDb();
  const deps: core.VersionLifecycleDeps = {
    db,
    t: await getServerErrors(),
    r2PublicUrl: process.env.R2_PUBLIC_URL,
    getBucket: getR2Bucket,
  };

  return { deps, userId: session.user.id };
}

/**
 * プロジェクトのバージョン（ファイル）を削除する Server Action。
 */
export const deleteVersion = async (versionId: string, projectSlug: string): Promise<ActionResult> => {
  const { deps, userId } = await lifecycleDeps();
  const result = await core.deleteVersion(deps, userId, versionId, projectSlug);
  if (!isActionError(result)) revalidatePath(`/projects/${projectSlug}`);

  return result;
};

/**
 * バージョンのアーカイブ状態を切り替える Server Action。
 */
export const setVersionArchived = async (
  versionId: string,
  projectSlug: string,
  archived: boolean,
): Promise<ActionResult> => {
  const { deps, userId } = await lifecycleDeps();
  const result = await core.setVersionArchived(deps, userId, versionId, projectSlug, archived);
  if (!isActionError(result)) revalidatePath(`/projects/${projectSlug}`);

  return result;
};
