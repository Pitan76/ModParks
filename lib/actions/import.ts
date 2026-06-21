"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { projects, userSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { revalidatePath } from "next/cache";

export interface ImportedProject {
  id: string;
  name: string;
  slug: string;
  description: string;
  type: "mod" | "plugin";
  license?: string;
  sourceUrl?: string;
  issueTrackerUrl?: string;
  websiteUrl?: string;
  iconUrl?: string;
}

export async function fetchModrinthProjects(): Promise<ImportedProject[]> {
  const { db, session } = await getAuthenticatedDb();
  
  const settings = await db.select().from(userSettings).where(eq(userSettings.userId, session.user.id)).get();
  if (!settings?.modrinthApiKey) {
    throw new Error("Modrinth API key is not configured.");
  }

  // Get user info
  const userRes = await fetch("https://api.modrinth.com/v2/user", {
    headers: { Authorization: settings.modrinthApiKey, "User-Agent": "ModParks/1.0" }
  });
  if (!userRes.ok) {
    const errorText = await userRes.text().catch(() => "Could not read error body");
    console.error("Modrinth API Error (User Fetch):", userRes.status, errorText);
    if (userRes.status === 401) {
      throw new Error("Modrinthの認証に失敗しました。設定画面に登録したAPIキー (Personal Access Token) が正しいか確認してください。PATは 'mrp_' から始まります。");
    }
    throw new Error(`Failed to fetch Modrinth user. Status: ${userRes.status}`);
  }
  const userData = (await userRes.json()) as { id: string };

  // Get user projects
  const projRes = await fetch(`https://api.modrinth.com/v2/user/${userData.id}/projects`, {
    headers: { Authorization: settings.modrinthApiKey, "User-Agent": "ModParks/1.0" }
  });
  if (!projRes.ok) {
    const errorText = await projRes.text().catch(() => "Could not read error body");
    console.error("Modrinth API Error (Projects Fetch):", projRes.status, errorText);
    throw new Error(`Failed to fetch Modrinth projects. Status: ${projRes.status}`);
  }
  const projectsData = (await projRes.json()) as any[];

  return projectsData.map((p) => ({
    id: p.id,
    name: p.title,
    slug: p.slug,
    description: p.description,
    type: p.project_type === "mod" ? "mod" : p.project_type === "plugin" ? "plugin" : "mod",
    license: p.license?.name,
    sourceUrl: p.source_url,
    issueTrackerUrl: p.issues_url,
    websiteUrl: `https://modrinth.com/mod/${p.slug}`,
    iconUrl: p.icon_url,
  }));
}

export async function fetchCurseForgeProjects(): Promise<ImportedProject[]> {
  const { db, session } = await getAuthenticatedDb();
  
  const settings = await db.select().from(userSettings).where(eq(userSettings.userId, session.user.id)).get();
  if (!settings?.curseforgeApiKey) {
    throw new Error("CurseForge API key is not configured.");
  }
  if (!settings?.curseforgeProjectId) {
    throw new Error("CurseForge Project ID is not configured.");
  }

  // 1. Fetch the project to get the authorId
  const projectRes = await fetch(`https://api.curseforge.com/v1/mods/${settings.curseforgeProjectId}`, {
    headers: { "x-api-key": settings.curseforgeApiKey, "Accept": "application/json", "User-Agent": "ModParks/1.0" }
  });

  if (!projectRes.ok) {
    const errorText = await projectRes.text();
    console.error("CurseForge Project Fetch Error:", projectRes.status, errorText);
    throw new Error(`Failed to fetch the specified CurseForge project. Status: ${projectRes.status}`);
  }

  const projectData = await projectRes.json() as any;
  const authors = projectData.data.authors;
  if (!authors || authors.length === 0) {
    throw new Error("No authors found for the specified CurseForge project.");
  }
  // Assume the first author is the main author
  const authorId = authors[0].id;

  // 2. Get user projects from CurseForge using the resolved authorId
  // gameId 432 is Minecraft
  const projRes = await fetch(`https://api.curseforge.com/v1/mods/search?gameId=432&authorId=${authorId}`, {
    headers: { "x-api-key": settings.curseforgeApiKey, "Accept": "application/json", "User-Agent": "ModParks/1.0" }
  });
  
  if (!projRes.ok) {
    const errorText = await projRes.text();
    console.error("CurseForge API Error:", projectRes.status, errorText);
    throw new Error(`Failed to fetch CurseForge projects. Status: ${projRes.status}`);
  }
  const resData = (await projRes.json()) as { data: any[] };
  const projectsData = resData.data;

  return projectsData.map((p) => ({
    id: p.id.toString(),
    name: p.name,
    slug: p.slug,
    description: p.summary,
    type: p.classId === 6 ? "mod" : p.classId === 17 ? "mod" : "plugin", // Simplified, 6 is Mods
    license: "All Rights Reserved", // CF doesn't expose license easily in search
    sourceUrl: p.links?.sourceUrl,
    issueTrackerUrl: p.links?.issuesUrl,
    websiteUrl: p.links?.websiteUrl,
    iconUrl: p.logo?.url,
  }));
}

/**
 * バッチインポートを実行する Server Action
 */
export async function importProjects(selectedProjects: ImportedProject[], source: "modrinth" | "curseforge", addExternalLink: boolean = true) {
  const { db, session } = await getAuthenticatedDb();
  if (!selectedProjects.length) return { success: true, importedCount: 0 };

  let importedCount = 0;

  for (const p of selectedProjects) {
    const existing = await db.select().from(projects).where(eq(projects.slug, p.slug)).get();
    if (existing) continue;

    let linksJson = "[]";
    if (addExternalLink && p.websiteUrl) {
      linksJson = JSON.stringify([{
        title: source === "modrinth" ? "Modrinth" : "CurseForge",
        url: p.websiteUrl
      }]);
    }

    await db.insert(projects).values({
      id: createId(),
      slug: p.slug,
      name: p.name,
      description: p.description || "",
      type: p.type,
      license: p.license || "All Rights Reserved",
      sourceUrl: p.sourceUrl || null,
      issueTrackerUrl: p.issueTrackerUrl || null,
      links: linksJson,
      iconUrl: p.iconUrl || null,
      modrinthId: source === "modrinth" ? p.id : null,
      curseforgeId: source === "curseforge" ? p.id : null,
      authorId: session.user.id,
      status: "draft",
    }).run();

    importedCount++;
  }

  revalidatePath("/projects");
  return { success: true, importedCount };
}
