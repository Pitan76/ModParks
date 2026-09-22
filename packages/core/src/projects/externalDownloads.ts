import { eq } from "drizzle-orm";
import type { Database } from "@modparks/core/db/client";
import { projects, userSettings } from "@modparks/core/db/schema";
import { findProjectPostById } from "@modparks/core/queries/post";
import { canEditProject } from "@modparks/core/projects/access";

/**
 * 外部プラットフォーム（Modrinth, CurseForge）のダウンロード数の同期の本体。
 * 画面（Next の Server Action / modparks-api）と cron の両方から呼ぶ。
 *
 * CurseForge の API キー（CURSEFORGE_FOR_STUDIOS_API_KEY）は秘密値なので呼び出し側が渡す。
 * 無ければ CFWidget で代用する。どちらの取得も失敗して構わない（取れた分だけ反映する）。
 */

const UA = "ModParks/1.0 (modparks.pitan76.net)";

export type SyncTarget = {
  id: string;
  modrinthId?: string | null;
  curseforgeId?: string | null;
  downloads: number;
  externalDownloads?: unknown;
};

/** Modrinth は API キーが無くても読める。作者のキーがあれば付ける（レート制限を緩めるため） */
async function fetchModrinthDownloads(modrinthId: string, apiKey: string | null | undefined): Promise<number> {
  const res = await fetch(`https://api.modrinth.com/v2/project/${modrinthId}`, {
    headers: { "User-Agent": UA, ...(apiKey ? { Authorization: apiKey } : {}) },
  });
  if (!res.ok) return 0;

  const data = (await res.json()) as { downloads?: number };
  return data.downloads || 0;
}

const cfHeaders = (apiKey: string) => ({ "x-api-key": apiKey, Accept: "application/json", "User-Agent": UA });

/** スラッグで登録されていたら数値 ID に直して保存する（以後の同期で検索を省くため） */
async function resolveCurseforgeId(db: Database, project: SyncTarget, curseforgeId: string, apiKey: string): Promise<string> {
  if (/^\d+$/.test(curseforgeId)) return curseforgeId;

  const res = await fetch(`https://api.curseforge.com/v1/mods/search?gameId=432&slug=${curseforgeId}`, { headers: cfHeaders(apiKey) });
  if (!res.ok) {
    console.error(`[CF Sync] Search API failed with status ${res.status}`);
    return curseforgeId;
  }

  const data = (await res.json()) as { data?: { id: number }[] };
  const found = data.data?.[0];
  if (!found) {
    console.error(`[CF Sync] Slug ${curseforgeId} not found in search.`);
    return curseforgeId;
  }

  const resolved = found.id.toString();
  await db.update(projects).set({ curseforgeId: resolved }).where(eq(projects.id, project.id)).run();
  return resolved;
}

/** @returns 取れなければ null（CFWidget で代用する） */
async function fetchCurseforgeApiDownloads(curseforgeId: string, apiKey: string): Promise<number | null> {
  if (!/^\d+$/.test(curseforgeId)) return null;

  const res = await fetch(`https://api.curseforge.com/v1/mods/${curseforgeId}`, { headers: cfHeaders(apiKey) });
  if (!res.ok) {
    console.error(`[CF Sync] Mod API failed with status ${res.status}`);
    return null;
  }

  const data = (await res.json()) as { data?: { downloadCount?: number } };
  return data.data?.downloadCount || 0;
}

async function fetchCfWidgetDownloads(curseforgeId: string): Promise<number> {
  if (!/^\d+$/.test(curseforgeId)) {
    console.error(`[CF Sync] Cannot use CFWidget with slug: ${curseforgeId}`);
    return 0;
  }

  const res = await fetch(`https://api.cfwidget.com/${curseforgeId}`, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    console.error(`[CF Sync] CFWidget API failed with status ${res.status}`);
    return 0;
  }

  const data = (await res.json()) as { downloads?: { total?: number } };
  return data.downloads?.total || 0;
}

async function fetchCurseforgeDownloads(db: Database, project: SyncTarget, curseforgeId: string, apiKey: string | undefined): Promise<number> {
  let targetId = curseforgeId;
  if (apiKey) {
    // 外部 API は外部I/O境界。公式 API が失敗しても CFWidget で代用する（フォールバック）
    try {
      targetId = await resolveCurseforgeId(db, project, curseforgeId, apiKey.trim());
      const viaApi = await fetchCurseforgeApiDownloads(targetId, apiKey.trim());
      if (viaApi !== null) return viaApi;
    } catch (e) {
      console.error(`[CF Sync] CurseForge API error:`, e);
    }
  }

  return fetchCfWidgetDownloads(targetId);
}

/** 失敗しても 0 として続ける。片方のサイトが落ちていても、もう片方は反映したい */
async function settle(task: Promise<number>): Promise<number> {
  try {
    return await task;
  } catch (e) {
    console.error("[Sync] external downloads fetch failed:", e);
    return 0;
  }
}

/**
 * 外部のダウンロード数を取り直し、projects に保存する（権限確認なし。cron 用）。
 * @param modrinthApiKey 作者のユーザー設定にある Modrinth の API キー
 * @param curseforgeApiKey 運営の CurseForge API キー（秘密値）
 * @returns 外部の合計
 */
export async function syncExternalDownloads(
  db: Database,
  project: SyncTarget,
  modrinthApiKey: string | null | undefined,
  curseforgeApiKey: string | undefined,
): Promise<number> {
  const [modrinthDl, curseforgeDl] = await Promise.all([
    project.modrinthId ? settle(fetchModrinthDownloads(project.modrinthId, modrinthApiKey)) : 0,
    project.curseforgeId ? settle(fetchCurseforgeDownloads(db, project, project.curseforgeId, curseforgeApiKey)) : 0,
  ]);

  const extObj: Record<string, number> = {
    ...((project.externalDownloads as Record<string, number>) || {}),
    lastSyncedAt: Date.now(),
  };
  if (modrinthDl > 0) extObj.modrinth = modrinthDl;
  if (curseforgeDl > 0) extObj.curseforge = curseforgeDl;

  const total = modrinthDl + curseforgeDl;
  await db.update(projects).set({ externalDownloads: extObj, totalDownloads: project.downloads + total }).where(eq(projects.id, project.id)).run();

  return total;
}

/** 編集画面からの手動同期。編集権限のある人だけが実行できる */
export async function syncExternalProjectData(db: Database, userId: string, projectId: string, curseforgeApiKey: string | undefined) {
  const project = await findProjectPostById(db, projectId);
  if (!project) throw new Error("Project not found");
  if (!(await canEditProject(db, project, userId))) throw new Error("Forbidden");

  const settings = await db.select({ modrinthApiKey: userSettings.modrinthApiKey }).from(userSettings).where(eq(userSettings.userId, userId)).get();
  const externalDownloads = await syncExternalDownloads(db, project, settings?.modrinthApiKey, curseforgeApiKey);

  return { success: true as const, externalDownloads, slug: project.slug };
}
