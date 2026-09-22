"use server";

import * as core from "@modparks/core/versions/batch";
import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { getServerErrors } from "@/lib/i18n/serverErrors";
import { isActionError, type ActionResult } from "@modparks/core/actionResult";
import { revalidatePath } from "next/cache";

/**
 * 選択した複数バージョンへ、対応MCバージョンを一括で追加する Server Action。本体は core/versions/batch.ts。
 */
export async function batchAddMcVersion(
  projectSlug: string,
  versionIds: string[],
  mcVersions: string[],
  syncModrinth: boolean,
  syncCurseforge: boolean,
): Promise<ActionResult<core.BatchAddMcVersionData>> {
  const { db, session } = await getAuthenticatedDb();
  const deps = { db, t: await getServerErrors() };

  const result = await core.batchAddMcVersion(deps, session.user.id, projectSlug, versionIds, mcVersions, syncModrinth, syncCurseforge);
  if (isActionError(result)) return result;

  revalidatePath(`/projects/${projectSlug}`);
  revalidatePath(`/projects/${projectSlug}/edit`);
  return result;
}
