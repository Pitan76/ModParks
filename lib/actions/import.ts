"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { projects, userSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { revalidatePath } from "next/cache";
import { fetchCfAuthorProjects } from "@/lib/curseforge";

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

/**
 * 外部サービス取得アクションの結果。
 * Server Action が throw するとproduction ではエラーメッセージが秘匿されてしまうため、
 * エラーもデータとして返してクライアントに実メッセージを届ける。
 */
export type FetchProjectsResult =
  | { ok: true; projects: ImportedProject[] }
  | { ok: false; error: string };

/** 想定内エラー（クライアントに文言をそのまま見せてよい） */
class ImportError extends Error {}

/**
 * 例外を握って {@link FetchProjectsResult} に変換する。
 * ImportError はユーザ向け文言、その他は汎用文言＋サーバログ。
 */
function toFetchResult(source: string, err: unknown): FetchProjectsResult {
  if (err instanceof ImportError) return { ok: false, error: err.message };
  console.error(`[import] Unexpected error while fetching ${source} projects:`, err);
  const detail = err instanceof Error ? err.message : String(err);
  return { ok: false, error: `${source} プロジェクトの取得に失敗しました: ${detail}` };
}

export async function fetchModrinthProjects(): Promise<FetchProjectsResult> {
  try {
    return { ok: true, projects: await loadModrinthProjects() };
  } catch (err) {
    return toFetchResult("Modrinth", err);
  }
}

async function loadModrinthProjects(): Promise<ImportedProject[]> {
  const { db, session } = await getAuthenticatedDb();
  
  const settings = await db.select().from(userSettings).where(eq(userSettings.userId, session.user.id)).get();
  if (!settings?.modrinthApiKey) {
    throw new ImportError("Modrinth API key is not configured.");
  }

  // Get user info
  const userRes = await fetch("https://api.modrinth.com/v2/user", {
    headers: { Authorization: settings.modrinthApiKey.trim(), "User-Agent": "ModParks/1.0" }
  });
  if (!userRes.ok) {
    const errorText = await userRes.text().catch(() => "Could not read error body");
    console.error("Modrinth API Error (User Fetch):", userRes.status, errorText);
    if (userRes.status === 401) {
      throw new ImportError("Modrinthの認証に失敗しました。設定画面に登録したAPIキー (Personal Access Token) が正しいか確認してください。PATは 'mrp_' から始まります。");
    }
    throw new ImportError(`Failed to fetch Modrinth user. Status: ${userRes.status}`);
  }
  const userData = (await userRes.json()) as { id: string };

  // Get user projects
  const projRes = await fetch(`https://api.modrinth.com/v2/user/${userData.id}/projects`, {
    headers: { Authorization: settings.modrinthApiKey.trim(), "User-Agent": "ModParks/1.0" }
  });
  if (!projRes.ok) {
    const errorText = await projRes.text().catch(() => "Could not read error body");
    console.error("Modrinth API Error (Projects Fetch):", projRes.status, errorText);
    throw new ImportError(`Failed to fetch Modrinth projects. Status: ${projRes.status}`);
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

export async function fetchCurseForgeProjects(): Promise<FetchProjectsResult> {
  try {
    return { ok: true, projects: await loadCurseForgeProjects() };
  } catch (err) {
    return toFetchResult("CurseForge", err);
  }
}

async function loadCurseForgeProjects(): Promise<ImportedProject[]> {
  const { db, session } = await getAuthenticatedDb();

  const settings = await db.select().from(userSettings).where(eq(userSettings.userId, session.user.id)).get();
  if (!settings?.curseforgeVerifiedAt || !settings.curseforgeAuthorId) {
    throw new ImportError("CurseForge の所有確認が未完了です。設定画面で所有確認を行ってください。");
  }

  // 所有確認済みの作者IDに紐づくプロジェクトのみを一覧する
  const projectsData = await fetchCfAuthorProjects(settings.curseforgeAuthorId);

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
  // 所有確認済み作者IDのプロジェクト集合を取得し直して照合する（本 action は直接呼び出し可能なため）
  let cfAllowedProjectIds: Set<string> | null = null;
  if (source === "curseforge") {
    const settings = await db.select().from(userSettings).where(eq(userSettings.userId, session.user.id)).get();
    if (!settings?.curseforgeVerifiedAt || !settings.curseforgeAuthorId) {
      return { success: false, error: "CurseForge の所有確認が未完了です。" };
    }
    const owned = await fetchCfAuthorProjects(settings.curseforgeAuthorId);
    cfAllowedProjectIds = new Set(owned.map((p) => p.id.toString()));
  }

  let importedCount = 0;
  const newProjects = [];

  for (const p of selectedProjects) {
    const existing = await db.select().from(projects).where(eq(projects.slug, p.slug)).get();
    if (existing) continue;

    // CurseForge: 所有確認済み作者のプロジェクト集合に無いものはスキップ（他人のプロジェクト奪取を防止）
    if (source === "curseforge" && cfAllowedProjectIds && !cfAllowedProjectIds.has(p.id)) {
      console.warn(`[import] Skipped CF project ${p.id} (${p.slug}): not owned by verified author for user ${session.user.id}`);
      continue;
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
