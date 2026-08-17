"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { posts, projects, versions, versionMcVersions, userSettings } from "@/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getServerErrors } from "@/lib/i18n/serverErrors";
import type { ActionResult } from "@/lib/actions/actionResult";
import type { Database } from "@/lib/db";
import type { Session } from "next-auth";

const MODRINTH_API_BASE = "https://api.modrinth.com/v2";
const UA = "ModParks/1.0 (modparks.pitan76.net)";

export type BatchMcVersionResult = {
  successCount: number;
  modrinthUpdated: number;
  modrinthFailed: number;
  modrinthSkipped: number;
};

/**
 * ModParks側の特定プロジェクトのバージョン情報を操作する
 */
async function modifyModParksVersions(
  db: Database,
  projectId: string,
  operation: "add" | "remove" | "set",
  mcs: string[],
  targetVersions: "all" | "latest"
) {
  let query = db.select().from(versions).where(eq(versions.projectId, projectId));
  if (targetVersions === "latest") {
    // @ts-ignore
    query = query.orderBy(desc(versions.createdAt)).limit(1);
  }
  const targetRecs = await query.all();
  if (targetRecs.length === 0) return [];

  const updatedVersionNumbers: string[] = [];

  for (const v of targetRecs) {
    let mcArr: string[] = [];
    try {
      mcArr = JSON.parse(v.mcVersions) as string[];
    } catch {}

    let nextMcArr: string[];
    if (operation === "add") {
      nextMcArr = [...new Set([...mcArr, ...mcs])];
    } else if (operation === "remove") {
      nextMcArr = mcArr.filter((mc) => !mcs.includes(mc));
    } else {
      nextMcArr = [...mcs];
    }

    await db
      .update(versions)
      .set({ mcVersions: JSON.stringify(nextMcArr) })
      .where(eq(versions.id, v.id))
      .run();

    await db.delete(versionMcVersions).where(eq(versionMcVersions.versionId, v.id)).run();
    if (nextMcArr.length > 0) {
      await db
        .insert(versionMcVersions)
        .values(nextMcArr.map((mc) => ({ versionId: v.id, mcVersion: mc })))
        .run();
    }
    updatedVersionNumbers.push(v.versionNumber);
  }

  return updatedVersionNumbers;
}

/**
 * Modrinth側の単一バージョンを更新する
 */
async function updateModrinthVersionRemote(
  apiKey: string,
  versionId: string,
  remoteGameVersions: string[],
  operation: "add" | "remove" | "set",
  mcs: string[]
): Promise<boolean> {
  let nextGameVersions: string[];
  if (operation === "add") {
    nextGameVersions = [...new Set([...remoteGameVersions, ...mcs])];
  } else if (operation === "remove") {
    nextGameVersions = remoteGameVersions.filter((mc) => !mcs.includes(mc));
  } else {
    nextGameVersions = [...mcs];
  }

  const res = await fetch(`${MODRINTH_API_BASE}/version/${versionId}`, {
    method: "PATCH",
    headers: { Authorization: apiKey, "User-Agent": UA, "Content-Type": "application/json" },
    body: JSON.stringify({ game_versions: nextGameVersions }),
  });
  return res.ok;
}

/**
 * Modrinth側の特定プロジェクトのバージョン情報を操作する
 */
async function modifyModrinthVersions(
  modrinthProjectId: string,
  apiKey: string,
  operation: "add" | "remove" | "set",
  mcs: string[],
  updatedVersionNumbers: string[]
) {
  const stats = { updated: 0, failed: 0, skipped: 0 };
  const res = await fetch(`${MODRINTH_API_BASE}/project/${modrinthProjectId}/version`, {
    headers: { Authorization: apiKey, "User-Agent": UA },
  });
  if (!res.ok) {
    stats.failed = updatedVersionNumbers.length;
    return stats;
  }

  const remoteVersions = (await res.json()) as { id: string; version_number: string; game_versions: string[] }[];
  const byVersionNumber = new Map(remoteVersions.map((v) => [v.version_number, v]));

  for (const vNum of updatedVersionNumbers) {
    const remote = byVersionNumber.get(vNum);
    if (!remote) {
      stats.skipped++;
      continue;
    }
    const success = await updateModrinthVersionRemote(apiKey, remote.id, remote.game_versions, operation, mcs);
    if (success) stats.updated++;
    else stats.failed++;
  }

  return stats;
}

/**
 * ログインユーザーが管理可能なプロジェクトIDのみを抽出する
 */
async function getManageableProjects(db: Database, session: Session, projectIds: string[]) {
  let query = db
    .select({ id: posts.id, modrinthId: projects.modrinthId, slug: posts.slug })
    .from(posts)
    .innerJoin(projects, eq(posts.id, projects.id))
    .where(inArray(posts.id, projectIds));

  // 管理者でない場合は自分が作成者であるもののみ
  const isAdmin = session.user.role === "admin";
  if (!isAdmin) {
    // @ts-ignore
    query = query.where(eq(posts.authorId, session.user.id));
  }

  return await query.all();
}

/**
 * 選択した複数プロジェクトのMCバージョンを一括で追加・削除・設定する Server Action
 */
export async function batchModifyProjectMcVersions(
  projectIds: string[],
  operation: "add" | "remove" | "set",
  mcVersions: string[],
  targetVersions: "all" | "latest",
  platforms: { modparks: boolean; modrinth: boolean }
): Promise<ActionResult<BatchMcVersionResult>> {
  const t = await getServerErrors();
  const { db, session } = await getAuthenticatedDb();

  const mcs = [...new Set(mcVersions.map((mc) => mc.trim()).filter(Boolean))];
  if (mcs.length === 0) return { error: t("version.batch.mcVersionRequired") };
  if (projectIds.length === 0) return { error: t("version.batch.noSelection") };

  const targets = await getManageableProjects(db, session, projectIds);
  if (targets.length === 0) return { error: t("common.forbidden") };

  const settings = await db.select().from(userSettings).where(eq(userSettings.userId, session.user.id)).get();
  const modrinthApiKey = settings?.modrinthApiKey?.trim();

  let successCount = 0;
  let modrinthUpdated = 0;
  let modrinthFailed = 0;
  let modrinthSkipped = 0;

  for (const proj of targets) {
    let updatedVersionNumbers: string[] = [];
    if (platforms.modparks) {
      updatedVersionNumbers = await modifyModParksVersions(db, proj.id, operation, mcs, targetVersions);
      if (updatedVersionNumbers.length > 0) successCount++;
    } else {
      // Modrinthのみ処理する場合でも、対象のバージョン番号をModParksのDBから取得する必要がある
      const localRecs = await db.select().from(versions).where(eq(versions.projectId, proj.id)).all();
      updatedVersionNumbers = localRecs.map((v) => v.versionNumber);
      if (targetVersions === "latest" && localRecs.length > 0) {
        const latest = localRecs.reduce((a, b) => (new Date(b.createdAt) > new Date(a.createdAt) ? b : a));
        updatedVersionNumbers = [latest.versionNumber];
      }
    }

    if (platforms.modrinth && proj.modrinthId && modrinthApiKey && updatedVersionNumbers.length > 0) {
      const stats = await modifyModrinthVersions(proj.modrinthId, modrinthApiKey, operation, mcs, updatedVersionNumbers);
      modrinthUpdated += stats.updated;
      modrinthFailed += stats.failed;
      modrinthSkipped += stats.skipped;
    }
  }

  revalidatePath("/projects/manage");
  return {
    success: true,
    data: { successCount, modrinthUpdated, modrinthFailed, modrinthSkipped },
  };
}
