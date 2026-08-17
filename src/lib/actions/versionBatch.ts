"use server";

import { getAuthenticatedDb, assertProjectAccess } from "@/lib/auth-helpers";
import { versions, versionMcVersions, userSettings } from "@/db/schema";
import { findProjectPostBySlug } from "@/lib/queries/post";
import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getServerErrors } from "@/lib/i18n/serverErrors";
import type { ActionResult } from "@/lib/actions/actionResult";
import type { ProjectPost } from "@/types/post";
import type { Database } from "@/lib/db";

const MODRINTH_API_BASE = "https://api.modrinth.com/v2";
const UA = "ModParks/1.0 (modparks.pitan76.net)";

type ModrinthSyncSummary = { updated: number; skipped: number; failed: number };

export type BatchAddMcVersionData = {
  updatedCount: number;
  modrinth?: ModrinthSyncSummary;
};

/**
 * Modrinth に登録済みのバージョン一覧を取得し、versionNumber が一致するものへ
 * game_versions を追記する。
 *
 * modparks 側の versions レコードは Modrinth のバージョンIDを保持していないため、
 * versionNumber の文字列一致でしか対応関係を特定できない。一致しないものは skipped 扱いにする。
 */
async function syncMcVersionToModrinth(
  modrinthProjectId: string,
  apiKey: string,
  targets: { versionNumber: string }[],
  mcVersions: string[],
): Promise<ModrinthSyncSummary> {
  const summary: ModrinthSyncSummary = { updated: 0, skipped: 0, failed: 0 };

  const listRes = await fetch(`${MODRINTH_API_BASE}/project/${modrinthProjectId}/version`, {
    headers: { Authorization: apiKey, "User-Agent": UA },
  });
  if (!listRes.ok) {
    summary.failed = targets.length;
    return summary;
  }
  const remoteVersions = (await listRes.json()) as { id: string; version_number: string; game_versions: string[] }[];
  const byVersionNumber = new Map(remoteVersions.map((v) => [v.version_number, v]));

  for (const target of targets) {
    const remote = byVersionNumber.get(target.versionNumber);
    if (!remote) {
      summary.skipped++;
      continue;
    }
    const toAdd = mcVersions.filter((mc) => !remote.game_versions.includes(mc));
    if (toAdd.length === 0) {
      summary.skipped++;
      continue;
    }
    const patchRes = await fetch(`${MODRINTH_API_BASE}/version/${remote.id}`, {
      method: "PATCH",
      headers: { Authorization: apiKey, "User-Agent": UA, "Content-Type": "application/json" },
      body: JSON.stringify({ game_versions: [...remote.game_versions, ...toAdd] }),
    });
    if (patchRes.ok) summary.updated++;
    else summary.failed++;
  }

  return summary;
}

/** projectSlug の所有権・アクセス権を確認し、対象バージョン群を検証する */
async function loadBatchTargets(db: Database, project: ProjectPost, versionIds: string[]) {
  const targets = await db.select().from(versions).where(inArray(versions.id, versionIds)).all();
  const belongsToProject = targets.length === versionIds.length && targets.every((v) => v.projectId === project.id);
  return belongsToProject ? targets : null;
}

/**
 * 選択した複数バージョンへ、対応MCバージョンを一括で追加する Server Action。
 *
 * 「1.21.1向けに配布したが1.21.2にも対応していた」といったケースで、
 * modparks内のバージョンと Modrinth 上のバージョンへ同時に反映する。
 * CurseForge には既存ファイルの対応バージョンを事後追加する公式APIが存在しないため対象外。
 */
export async function batchAddMcVersion(
  projectSlug: string,
  versionIds: string[],
  mcVersions: string[],
  syncModrinth: boolean,
): Promise<ActionResult<BatchAddMcVersionData>> {
  const t = await getServerErrors();
  const { db, session } = await getAuthenticatedDb();

  const project = await findProjectPostBySlug(db, projectSlug);
  if (!project) return { error: t("project.notFound") };

  try {
    await assertProjectAccess(db, project, session);
  } catch {
    return { error: t("common.forbidden") };
  }

  const mcs = [...new Set(mcVersions.map((mc) => mc.trim()).filter(Boolean))];
  if (mcs.length === 0) return { error: t("version.batch.mcVersionRequired") };
  if (versionIds.length === 0) return { error: t("version.batch.noSelection") };

  const targets = await loadBatchTargets(db, project, versionIds);
  if (!targets) return { error: t("version.notInProject") };

  let updatedCount = 0;
  for (const v of targets) {
    let mcVersionsArr: string[] = [];
    try {
      mcVersionsArr = JSON.parse(v.mcVersions) as string[];
    } catch {}
    const toAdd = mcs.filter((mc) => !mcVersionsArr.includes(mc));
    if (toAdd.length === 0) continue;

    await db.update(versions).set({ mcVersions: JSON.stringify([...mcVersionsArr, ...toAdd]) }).where(eq(versions.id, v.id)).run();
    await db.insert(versionMcVersions).values(toAdd.map((mc) => ({ versionId: v.id, mcVersion: mc }))).run();
    updatedCount++;
  }

  let modrinth: ModrinthSyncSummary | undefined;
  if (syncModrinth && project.modrinthId) {
    const settings = await db.select().from(userSettings).where(eq(userSettings.userId, session.user.id)).get();
    if (settings?.modrinthApiKey) {
      modrinth = await syncMcVersionToModrinth(
        project.modrinthId,
        settings.modrinthApiKey.trim(),
        targets.map((v) => ({ versionNumber: v.versionNumber })),
        mcs,
      );
    }
  }

  revalidatePath(`/projects/${projectSlug}`);
  revalidatePath(`/projects/${projectSlug}/edit`);

  return { success: true, data: { updatedCount, modrinth } };
}
