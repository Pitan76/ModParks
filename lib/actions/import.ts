"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { projects, userSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { revalidatePath } from "next/cache";
import { getConsoleApiKey, fetchCfProject, verifyCfProjectOwnership } from "@/lib/curseforge";

export interface ImportedProject {
  id: string;
  name: string;
  slug: string;
  description: string;
  type: "mod" | "plugin" | "resourcepack" | "datapack" | "shader" | "modpack";
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
    headers: { Authorization: settings.modrinthApiKey.trim(), "User-Agent": "ModParks/1.0" }
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
    headers: { Authorization: settings.modrinthApiKey.trim(), "User-Agent": "ModParks/1.0" }
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
  if (!settings?.curseforgeAuthorToken) {
    throw new Error("CurseForge の Author トークンが未設定です。設定画面で登録してください。");
  }
  if (!settings?.curseforgeProjectId) {
    throw new Error("CurseForge Project ID is not configured.");
  }

  const consoleKey = getConsoleApiKey();

  // 1. 共通コンソールキーで対象プロジェクトを取得し、作者を特定する
  const projectData = await fetchCfProject(settings.curseforgeProjectId);
  if (!projectData) {
    throw new Error(`Failed to fetch the specified CurseForge project (ID: ${settings.curseforgeProjectId}).`);
  }
  const authors = projectData.authors;
  if (!authors || authors.length === 0) {
    throw new Error("No authors found for the specified CurseForge project.");
  }

  // 2. Author トークンで対象プロジェクトの所有を検証（本人確認）
  //    コンソールキーは身元と紐づかないため、この検証を通らない限りインポートを許可しない
  const owns = await verifyCfProjectOwnership(projectData.id.toString(), settings.curseforgeAuthorToken);
  if (!owns) {
    throw new Error("指定されたプロジェクトの所有者であることを確認できませんでした。Author トークンと Project ID が正しいか確認してください。");
  }

  // 3. 検証済み作者のプロジェクト一覧をコンソールキーで取得 (gameId 432 = Minecraft)
  const authorId = authors[0].id;
  const projRes = await fetch(`https://api.curseforge.com/v1/mods/search?gameId=432&authorId=${authorId}`, {
    headers: { "x-api-key": consoleKey, "Accept": "application/json", "User-Agent": "ModParks/1.0 (modparks.pitan76.net)" }
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

  // CurseForge はクライアント送信のプロジェクトを信用せず、インポート時に
  // Author トークンで各プロジェクトの所有を再検証する（本 action は直接呼び出し可能なため）
  let cfAuthorToken: string | null = null;
  if (source === "curseforge") {
    const settings = await db.select().from(userSettings).where(eq(userSettings.userId, session.user.id)).get();
    if (!settings?.curseforgeAuthorToken) {
      return { success: false, error: "CurseForge の Author トークンが未設定です。" };
    }
    cfAuthorToken = settings.curseforgeAuthorToken;
  }

  let importedCount = 0;
  const newProjects = [];

  for (const p of selectedProjects) {
    const existing = await db.select().from(projects).where(eq(projects.slug, p.slug)).get();
    if (existing) continue;

    // CurseForge: 所有者本人でないプロジェクトはスキップ（他人のプロジェクト奪取を防止）
    if (source === "curseforge" && cfAuthorToken) {
      const owns = await verifyCfProjectOwnership(p.id, cfAuthorToken);
      if (!owns) {
        console.warn(`[import] Skipped CF project ${p.id} (${p.slug}): ownership not verified for user ${session.user.id}`);
        continue;
      }
    }

    let linksJson = "[]";
    if (addExternalLink && p.websiteUrl) {
      linksJson = JSON.stringify([{
        title: source === "modrinth" ? "Modrinth" : "CurseForge",
        url: p.websiteUrl
      }]);
    }

    newProjects.push({
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
      status: "draft" as const,
    });
  }

  if (newProjects.length > 0) {
    await db.insert(projects).values(newProjects).run();
    importedCount = newProjects.length;
  }

  revalidatePath("/projects");
  return { success: true, importedCount };
}
