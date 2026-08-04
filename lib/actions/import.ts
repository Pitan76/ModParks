"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { posts, projects, userSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { findProjectPostBySlug } from "@/lib/queries/post";
import { createId } from "@paralleldrive/cuid2";
import { revalidatePath } from "next/cache";
import { fetchCfAuthorProjects } from "@/lib/curseforge";
import { getServerErrors } from "@/lib/i18n/serverErrors";
import { type ContentType } from "@/lib/data/projectTypes";

export interface ImportedProject {
  id: string;
  name: string;
  slug: string;
  description: string;
  type: ContentType;
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
      throw new ImportError((await getServerErrors())("import.modrinthAuthFailed"));
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

  const existingProjects = await db
    .select({
      modrinthId: projects.modrinthId,
      slug: posts.slug,
    })
    .from(projects)
    .innerJoin(posts, eq(posts.id, projects.id))
    .all();

  const existingModrinthIds = new Set(
    existingProjects.map((p) => p.modrinthId).filter(Boolean)
  );
  const existingSlugs = new Set(
    existingProjects.map((p) => p.slug).filter(Boolean)
  );

  return projectsData
    .map((p) => ({
      id: p.id,
      name: p.title,
      slug: p.slug,
      description: p.description,
      type: (p.project_type === "mod" ? "mod" : p.project_type === "plugin" ? "plugin" : "mod") as ImportedProject["type"],
      license: p.license?.name,
      sourceUrl: p.source_url,
      issueTrackerUrl: p.issues_url,
      websiteUrl: `https://modrinth.com/mod/${p.slug}`,
      iconUrl: p.icon_url,
    }))
    .filter((p) => !existingModrinthIds.has(p.id) && !existingSlugs.has(p.slug));
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
    throw new ImportError((await getServerErrors())("import.curseforgeNotVerifiedDetail"));
  }

  // 所有確認済みの作者IDに紐づくプロジェクトのみを一覧する
  const projectsData = await fetchCfAuthorProjects(settings.curseforgeAuthorId);

  const existingProjects = await db
    .select({
      curseforgeId: projects.curseforgeId,
      slug: posts.slug,
    })
    .from(projects)
    .innerJoin(posts, eq(posts.id, projects.id))
    .all();

  const existingCfIds = new Set(
    existingProjects.map((p) => p.curseforgeId).filter(Boolean)
  );
  const existingSlugs = new Set(
    existingProjects.map((p) => p.slug).filter(Boolean)
  );

  return projectsData
    .map((p): ImportedProject => ({
      id: p.id.toString(),
      name: p.name,
      slug: p.slug,
      description: p.summary ?? "",
      type: (p.classId === 6 ? "mod" : p.classId === 17 ? "mod" : "plugin") as ImportedProject["type"], // Simplified, 6 is Mods
      license: "All Rights Reserved", // CF doesn't expose license easily in search
      sourceUrl: p.links?.sourceUrl,
      issueTrackerUrl: p.links?.issuesUrl,
      websiteUrl: p.links?.websiteUrl,
      iconUrl: p.logo?.url,
    }))
    .filter((p) => !existingCfIds.has(p.id) && !existingSlugs.has(p.slug));
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
      return { success: false, error: (await getServerErrors())("import.curseforgeNotVerified") };
    }
    const owned = await fetchCfAuthorProjects(settings.curseforgeAuthorId);
    cfAllowedProjectIds = new Set(owned.map((p) => p.id.toString()));
  }

  let importedCount = 0;
  // 型注釈を付けて、posts / projects どちらのカラムかを取り違えたときに
  // コンパイルエラーで気づけるようにする（暗黙 any[] だと素通りしてしまう）
  const newProjects: {
    post: typeof posts.$inferInsert;
    project: typeof projects.$inferInsert;
  }[] = [];

  for (const p of selectedProjects) {
    const existing = await findProjectPostBySlug(db, p.slug);
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

    const id = createId();
    newProjects.push({
      post: {
        id,
        authorId: session.user.id,
        kind: "project" as const,
        slug: p.slug,
        title: p.name,
        body: p.description || "",
        bodyFormat: "markdown" as const,
        visibility: "draft" as const,
      },
      project: {
        id,
        type: p.type,
        license: p.license || "All Rights Reserved",
        sourceUrl: p.sourceUrl || null,
        issueTrackerUrl: p.issueTrackerUrl || null,
        links: linksJson,
        iconUrl: p.iconUrl || null,
        modrinthId: source === "modrinth" ? p.id : null,
        curseforgeId: source === "curseforge" ? p.id : null,
      },
    });
  }

  if (newProjects.length > 0) {
    // posts を先に全件入れてから projects を入れる。
    // 逆順だと外部キー（projects.id -> posts.id）に違反する。
    await db.batch([
      db.insert(posts).values(newProjects.map((n) => n.post)),
      db.insert(projects).values(newProjects.map((n) => n.project)),
    ]);
    importedCount = newProjects.length;
  }

  revalidatePath("/projects");
  return { success: true, importedCount };
}
