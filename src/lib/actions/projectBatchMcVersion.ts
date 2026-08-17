"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { posts, projects, versions, versionMcVersions, userSettings } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getServerErrors } from "@/lib/i18n/serverErrors";
import type { ActionResult } from "@/lib/actions/actionResult";
import type { Database } from "@/lib/db";
import type { Session } from "next-auth";
import { applyMcVersionOperation } from "@/lib/externalSync/mcVersionOps";
import { selectVersionTargets } from "@/lib/externalSync/versionTargets";

const MODRINTH_API_BASE = "https://api.modrinth.com/v2";
const UA = "ModParks/1.0 (modparks.pitan76.net)";

export type BatchMcVersionResult = {
  successCount: number;
  modrinthUpdated: number;
  modrinthFailed: number;
  modrinthSkipped: number;
};

const parseJsonArray = (raw: string | null): string[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
};

/**
 * ModParks側の特定プロジェクトのバージョン情報を操作する。
 *
 * 対象は {@link selectVersionTargets} で選ぶ（ローダー絞り込みと、ローダーごとの最新の解釈）。
 */
async function modifyModParksVersions(
  db: Database,
  projectId: string,
  operation: "add" | "remove" | "set",
  mcs: string[],
  targetVersions: "all" | "latest",
  targetLoaders: string[]
) {
  const allVersions = await db.select().from(versions).where(eq(versions.projectId, projectId)).all();
  const targetRecs = selectVersionTargets(allVersions, {
    loadersOf: (v) => parseJsonArray(v.loaders),
    publishedAtOf: (v) => new Date(v.createdAt).getTime(),
    platforms: targetLoaders,
    targetVersions,
  });
  if (targetRecs.length === 0) return [];

  const updatedVersionNumbers: string[] = [];

  for (const v of targetRecs) {
    const nextMcArr = applyMcVersionOperation(parseJsonArray(v.mcVersions), operation, mcs);

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
  const nextGameVersions = applyMcVersionOperation(remoteGameVersions, operation, mcs);

  const res = await fetch(`${MODRINTH_API_BASE}/version/${versionId}`, {
    method: "PATCH",
    headers: { Authorization: apiKey, "User-Agent": UA, "Content-Type": "application/json" },
    body: JSON.stringify({ game_versions: nextGameVersions }),
  });
  return res.ok;
}

type ModrinthRemoteVersion = {
  id: string;
  version_number: string;
  game_versions: string[];
  loaders: string[];
  date_published: string;
};

/**
 * Modrinth側の特定プロジェクトのバージョン情報を操作する。
 *
 * 対応関係は versionNumber の文字列一致でしか特定できないが、Modrinth 側で別名が
 * 付いている（例: modparks が "1.0.3-fix.1" で Modrinth が "1.0.3"）ことや、
 * modparks に未登録であることは珍しくない。1 件も一致しない場合に何もしないと
 * 「実行したのに反映されない」ため、その時は Modrinth の一覧から
 * ローダー絞り込みと対象指定（最新/すべて）に従って選び直す。
 */
async function modifyModrinthVersions(
  modrinthProjectId: string,
  apiKey: string,
  operation: "add" | "remove" | "set",
  mcs: string[],
  updatedVersionNumbers: string[],
  targetVersions: "all" | "latest",
  targetLoaders: string[],
) {
  const stats = { updated: 0, failed: 0, skipped: 0 };
  const res = await fetch(`${MODRINTH_API_BASE}/project/${modrinthProjectId}/version`, {
    headers: { Authorization: apiKey, "User-Agent": UA },
  });
  if (!res.ok) {
    stats.failed = Math.max(updatedVersionNumbers.length, 1);
    return stats;
  }

  const remoteVersions = (await res.json()) as ModrinthRemoteVersion[];

  const matched = updatedVersionNumbers
    .map((vNum) => remoteVersions.find((v) => v.version_number === vNum))
    .filter((v): v is ModrinthRemoteVersion => !!v);

  const targets = matched.length > 0
    ? matched
    : selectVersionTargets(remoteVersions, {
        loadersOf: (v) => v.loaders ?? [],
        publishedAtOf: (v) => new Date(v.date_published).getTime(),
        platforms: targetLoaders,
        targetVersions,
      });

  // 一部だけ一致したときの未一致分は対象外として数える。
  // 全く一致しなかった場合は上で選び直しているので対象外は無い
  stats.skipped = matched.length > 0 ? updatedVersionNumbers.length - matched.length : 0;

  for (const remote of targets) {
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
  const isAdmin = session.user.role === "admin";

  // 選択したIDの絞り込みと作者の絞り込みは and() で合成する。
  // .where() を2回繋ぐと先の条件が捨てられ、選択外のプロジェクトまで対象になってしまう
  const scope = isAdmin
    ? inArray(posts.id, projectIds)
    : and(inArray(posts.id, projectIds), eq(posts.authorId, session.user.id));

  return await db
    .select({ id: posts.id, modrinthId: projects.modrinthId, slug: posts.slug })
    .from(posts)
    .innerJoin(projects, eq(posts.id, projects.id))
    .where(scope)
    .all();
}

/**
 * 選択した複数プロジェクトのMCバージョンを一括で追加・削除・設定する Server Action
 *
 * @param platforms 反映先（modparks 本体 / Modrinth）
 * @param targetLoaders 対象を絞り込むローダー。空なら全ローダー。
 *                      指定時の targetVersions="latest" はローダーごとの最新を意味する
 */
export async function batchModifyProjectMcVersions(
  projectIds: string[],
  operation: "add" | "remove" | "set",
  mcVersions: string[],
  targetVersions: "all" | "latest",
  platforms: { modparks: boolean; modrinth: boolean },
  targetLoaders: string[] = []
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
      updatedVersionNumbers = await modifyModParksVersions(db, proj.id, operation, mcs, targetVersions, targetLoaders);
      if (updatedVersionNumbers.length > 0) successCount++;
    } else {
      // Modrinthのみ反映する場合も、突き合わせ用にModParks側の対象バージョン番号を出しておく
      const localRecs = await db.select().from(versions).where(eq(versions.projectId, proj.id)).all();
      updatedVersionNumbers = selectVersionTargets(localRecs, {
        loadersOf: (v) => parseJsonArray(v.loaders),
        publishedAtOf: (v) => new Date(v.createdAt).getTime(),
        platforms: targetLoaders,
        targetVersions,
      }).map((v) => v.versionNumber);
    }

    if (platforms.modrinth && proj.modrinthId && modrinthApiKey) {
      const stats = await modifyModrinthVersions(proj.modrinthId, modrinthApiKey, operation, mcs, updatedVersionNumbers, targetVersions, targetLoaders);
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
