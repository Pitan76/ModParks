"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { posts, projects, versions, versionMcVersions, userSettings } from "@/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getServerErrors } from "@/lib/i18n/serverErrors";
import type { ActionResult } from "@/lib/actions/actionResult";
import type { Database } from "@/lib/db";
import type { Session } from "next-auth";
import { applyMcVersionOperation } from "@/lib/externalSync/mcVersionOps";

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
  const baseQuery = db.select().from(versions).where(eq(versions.projectId, projectId));
  const targetRecs = targetVersions === "latest"
    ? await baseQuery.orderBy(desc(versions.createdAt)).limit(1).all()
    : await baseQuery.all();
  if (targetRecs.length === 0) return [];

  const updatedVersionNumbers: string[] = [];

  for (const v of targetRecs) {
    let mcArr: string[] = [];
    try {
      mcArr = JSON.parse(v.mcVersions) as string[];
    } catch {}

    const nextMcArr = applyMcVersionOperation(mcArr, operation, mcs);

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

type ModrinthRemoteVersion = { id: string; version_number: string; game_versions: string[]; date_published: string };

/**
 * modparks側のバージョン番号と突き合わせられないときに、Modrinthの一覧そのものから
 * 対象を選ぶ。"latest" は公開日時が最も新しいものを1件、"all" は全件。
 */
function selectRemoteVersionsWithoutLocalMatch(
  remoteVersions: ModrinthRemoteVersion[],
  targetVersions: "all" | "latest",
): ModrinthRemoteVersion[] {
  if (targetVersions === "all") return remoteVersions;
  if (remoteVersions.length === 0) return [];
  return [[...remoteVersions].sort((a, b) => new Date(b.date_published).getTime() - new Date(a.date_published).getTime())[0]];
}

/**
 * Modrinth側の特定プロジェクトのバージョン情報を操作する。
 *
 * 対応関係は versionNumber の文字列一致でしか特定できないが、Modrinth 側で別名が
 * 付いている（例: modparks が "1.0.3-fix.1" で Modrinth が "1.0.3"）ことや、
 * modparks に未登録であることは珍しくない。1 件も一致しない場合に何もしないと
 * 「実行したのに反映されない」ため、その時は対象バージョンの指定（最新/すべて）に
 * 従って Modrinth の一覧から選び直す。
 */
async function modifyModrinthVersions(
  modrinthProjectId: string,
  apiKey: string,
  operation: "add" | "remove" | "set",
  mcs: string[],
  updatedVersionNumbers: string[],
  targetVersions: "all" | "latest",
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
    : selectRemoteVersionsWithoutLocalMatch(remoteVersions, targetVersions);

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

    if (platforms.modrinth && proj.modrinthId && modrinthApiKey) {
      const stats = await modifyModrinthVersions(proj.modrinthId, modrinthApiKey, operation, mcs, updatedVersionNumbers, targetVersions);
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
