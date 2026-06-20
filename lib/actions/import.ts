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
  license: string;
  sourceUrl?: string;
  issueTrackerUrl?: string;
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
  if (!userRes.ok) throw new Error("Failed to fetch Modrinth user.");
  const userData = (await userRes.json()) as { id: string };

  // Get user projects
  const projRes = await fetch(`https://api.modrinth.com/v2/user/${userData.id}/projects`, {
    headers: { Authorization: settings.modrinthApiKey, "User-Agent": "ModParks/1.0" }
  });
  if (!projRes.ok) throw new Error("Failed to fetch Modrinth projects.");
  const projectsData = (await projRes.json()) as any[];

  return projectsData.map((p) => ({
    id: p.id,
    name: p.title,
    slug: p.slug,
    description: p.description,
    type: p.project_type === "mod" ? "mod" : "plugin",
    license: p.license?.id || "All Rights Reserved",
    sourceUrl: p.source_url,
    issueTrackerUrl: p.issues_url,
    iconUrl: p.icon_url,
  }));
}

export async function fetchCurseForgeProjects(): Promise<ImportedProject[]> {
  const { db, session } = await getAuthenticatedDb();
  
  const settings = await db.select().from(userSettings).where(eq(userSettings.userId, session.user.id)).get();
  if (!settings?.curseforgeApiKey) {
    throw new Error("CurseForge API key is not configured.");
  }
  if (!settings?.curseforgeAuthorId) {
    throw new Error("CurseForge Author ID is not configured.");
  }

  // Get user projects from CurseForge
  // gameId 432 is Minecraft
  const projRes = await fetch(`https://api.curseforge.com/v1/mods/search?gameId=432&authorId=${settings.curseforgeAuthorId}`, {
    headers: { "x-api-key": settings.curseforgeApiKey, "Accept": "application/json", "User-Agent": "ModParks/1.0" }
  });
  
  if (!projRes.ok) {
    const errorText = await projRes.text();
    console.error("CurseForge API Error:", projRes.status, errorText);
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
    iconUrl: p.logo?.url,
  }));
}

export async function importProjects(selectedProjects: ImportedProject[], source: "modrinth" | "curseforge") {
  const { db, session } = await getAuthenticatedDb();

  let importedCount = 0;

  for (const p of selectedProjects) {
    const existing = await db.select().from(projects).where(eq(projects.slug, p.slug)).get();
    if (existing) continue;

    await db.insert(projects).values({
      id: createId(),
      slug: p.slug,
      name: p.name,
      description: p.description,
      type: p.type,
      license: p.license,
      sourceUrl: p.sourceUrl || null,
      issueTrackerUrl: p.issueTrackerUrl || null,
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
