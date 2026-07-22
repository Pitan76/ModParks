"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * 外部プラットフォーム（Modrinth, CurseForge）からプロジェクトのダウンロード数を同期するシステム関数
 */
export const syncExternalProjectDataSystem = async (db: any, project: any, settings: any) => {
  let newExtDl = 0;
  let modrinthDl = 0;
  let curseforgeDl = 0;
  
  const fetchModrinth = async () => {
    if (!project.modrinthId) return;
    try {
      const res = await fetch(`https://api.modrinth.com/v2/project/${project.modrinthId}`, {
        headers: {
          "User-Agent": "ModParks/1.0 (modparks.pitan76.net)",
          ...(settings?.modrinthApiKey ? { Authorization: settings.modrinthApiKey } : {})
        },
        next: { revalidate: 300 },
      });
      if (res.ok) {
        const data = await res.json() as any;
        modrinthDl = (data.downloads || 0);
        newExtDl += modrinthDl;
      }
    } catch(e) {}
  };
  
  const fetchCurseforge = async () => {
    if (!project.curseforgeId) return;
    try {
      const rawCfApiKey = process.env.CURSEFORGE_FOR_STUDIOS_API_KEY;
      if (rawCfApiKey) {
        const cfApiKey = rawCfApiKey.trim();
        let targetCfId = project.curseforgeId;
        
        if (!/^\d+$/.test(targetCfId)) {
          const searchRes = await fetch(`https://api.curseforge.com/v1/mods/search?gameId=432&slug=${targetCfId}`, {
            headers: { 
              "x-api-key": cfApiKey, 
              "Accept": "application/json",
              "User-Agent": "ModParks/1.0 (modparks.pitan76.net)"
            },
            next: { revalidate: 300 },
          });
          if (searchRes.ok) {
            const searchData = await searchRes.json() as any;
            if (searchData.data && searchData.data.length > 0) {
              targetCfId = searchData.data[0].id.toString();
              console.log(`[CF Sync] Resolved slug ${project.curseforgeId} to ID ${targetCfId}`);
              await db.update(projects).set({ curseforgeId: targetCfId }).where(eq(projects.id, project.id)).run();
            } else {
              console.error(`[CF Sync] Slug ${targetCfId} not found in search.`);
              throw new Error("CF_SLUG_NOT_FOUND");
            }
          } else {
            console.error(`[CF Sync] Search API failed with status ${searchRes.status}`);
            const errText = await searchRes.text().catch(() => "");
            console.error(`[CF Sync] Search Response: ${errText}`);
            throw new Error("CF_SEARCH_API_FAILED");
          }
        }

        console.log(`[CF Sync] Fetching data for ID ${targetCfId}`);
        const res = await fetch(`https://api.curseforge.com/v1/mods/${targetCfId}`, {
          headers: { 
            "x-api-key": cfApiKey, 
            "Accept": "application/json",
            "User-Agent": "ModParks/1.0 (modparks.pitan76.net)"
          },
          next: { revalidate: 300 },
        });
        if (res.ok) {
          const data = await res.json() as any;
          curseforgeDl = (data.data?.downloadCount || 0);
          console.log(`[CF Sync] Fetched downloads: ${curseforgeDl}`);
          newExtDl += curseforgeDl;
        } else {
          console.error(`[CF Sync] Mod API failed with status ${res.status}`);
          const errText = await res.text().catch(() => "");
          console.error(`[CF Sync] Mod API Response: ${errText}`);
          throw new Error("CF_MOD_API_FAILED");
        }
      } else {
        console.log(`[CF Sync] API key is missing. Trying CFWidget fallback...`);
        let targetCfId = project.curseforgeId;
        
        if (/^\d+$/.test(targetCfId)) {
          const cfwRes = await fetch(`https://api.cfwidget.com/${targetCfId}`, {
            headers: { "User-Agent": "ModParks/1.0 (modparks.pitan76.net)" },
            next: { revalidate: 300 },
          });
          if (cfwRes.ok) {
            const cfwData = await cfwRes.json() as any;
            curseforgeDl = (cfwData.downloads?.total || 0);
            newExtDl += curseforgeDl;
            console.log(`[CF Sync] Fallback: Fetched via CFWidget: ${curseforgeDl}`);
          } else {
            console.error(`[CF Sync] CFWidget API failed with status ${cfwRes.status}`);
            throw new Error("CF_API_KEY_MISSING");
          }
        } else {
          console.error(`[CF Sync] Cannot use CFWidget with slug: ${targetCfId}`);
          throw new Error("CF_API_KEY_MISSING");
        }
      }
    } catch(e) {
      console.error(`[CF Sync] Exception:`, e);
      throw e;
    }
  };

  await Promise.allSettled([fetchModrinth(), fetchCurseforge()]);

  const extObj: Record<string, number> = {
    ...(project.externalDownloads as Record<string, number> || {}),
    lastSyncedAt: Date.now()
  };
  
  if (modrinthDl > 0) extObj.modrinth = modrinthDl;
  if (curseforgeDl > 0) extObj.curseforge = curseforgeDl;
  
  await db.update(projects).set({ 
    externalDownloads: extObj,
    totalDownloads: project.downloads + newExtDl
  }).where(eq(projects.id, project.id)).run();

  return newExtDl;
};

/**
 * 特定のプロジェクトの外部ダウンロード数を手動で同期する Server Action。
 */
export const syncExternalProjectData = async (projectId: string) => {
  const { db, session } = await getAuthenticatedDb();
  
  const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project) throw new Error("Project not found");

  const { assertProjectAccess } = await import("@/lib/auth-helpers");
  await assertProjectAccess(db, project, session);

  const { userSettings } = await import("@/db/schema");
  const settings = await db.query.userSettings.findFirst({ where: eq(userSettings.userId, session.user.id) });
  
  const newExtDl = await syncExternalProjectDataSystem(db, project, settings);
  
  revalidatePath(`/projects/${project.slug}`);
  return { success: true, externalDownloads: newExtDl };
};
