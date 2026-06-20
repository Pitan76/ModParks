"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { projects, userSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { revalidatePath } from "next/cache";

export async function fetchModrinthProjects() {
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
  const userData = (await userRes.json()) as any;

  // Get user projects
  const projRes = await fetch(`https://api.modrinth.com/v2/user/${userData.id}/projects`, {
    headers: { Authorization: settings.modrinthApiKey, "User-Agent": "ModParks/1.0" }
  });
  if (!projRes.ok) throw new Error("Failed to fetch Modrinth projects.");
  const projectsData = (await projRes.json()) as any[];

  return projectsData.map((p: any) => ({
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

export async function importProjectsFromModrinth(selectedProjects: any[]) {
  const { db, session } = await getAuthenticatedDb();

  let importedCount = 0;

  for (const p of selectedProjects) {
    // Check if project already exists (by slug or modrinthId)
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
      modrinthId: p.id,
      authorId: session.user.id,
      status: "draft",
    }).run();

    importedCount++;
  }

  revalidatePath("/projects");
  return { success: true, importedCount };
}
