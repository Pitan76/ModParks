"use server";

import { getAuthenticatedDb, assertProjectAccess } from "@/lib/auth-helpers";
import { getDatabase } from "@/lib/db";
import { projects, projectTags, projectMembers, users, userProfiles, versions, userSettings, ideas } from "@/db/schema";
import { createProjectSchema, updateProjectSchema } from "@/lib/validations";
import { createId } from "@paralleldrive/cuid2";
import { eq, desc, and, or, sql, inArray, isNull, getTableColumns } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buildProjectSearchConditions, resolveProjectOrderBy } from "@/lib/queries/projectSearch";
import { notifyNewProject } from "@/lib/notifications/notify";

/** 下書き→公開の初回公開時のみ、作者フォロワーへ新プロジェクト通知を送る */
async function maybeNotifyPublish(
  db: any,
  project: { slug: string; name: string; iconUrl: string | null; authorId: string; status: string },
  newSlug: string,
  newStatus: string | undefined,
): Promise<void> {
  if (project.status !== "draft") return;
  if (newStatus !== "public" && newStatus !== "unlisted") return;

  const author = await db
    .select({ displayName: userProfiles.displayName, username: users.name })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(eq(users.id, project.authorId))
    .get();

  const authorName = author?.displayName || author?.username || "";
  await notifyNewProject(db, { ...project, slug: newSlug, name: project.name }, authorName);
}

// ─── プロジェクト作成 ─────────────────────────────────────────────────────────

/**
 * 新しいプロジェクト（Mod/Plugin）を作成する Server Action
 * @param formData 送信されたフォームデータ (name, summary, type, description 等)
 * @returns { success: boolean, slug: string } または { error: Record<string, string[]> }
 * @throws Unauthorized ログインしていない場合
 */
export async function createProject(formData: FormData) {
  const { db, session } = await getAuthenticatedDb();

  const raw = {
    name:        formData.get("name"),
    slug:        formData.get("slug"),
    description: formData.get("description"),
    descriptionFormat: formData.get("descriptionFormat"),
    type:        formData.get("type"),
    license:     formData.get("license"),
    sourceUrl:   formData.get("sourceUrl"),
    links:       formData.get("links"),
    tags:        formData.getAll("tags"),
  };

  const parsed = createProjectSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { name, slug, description, descriptionFormat, type, license, sourceUrl, links, tags } = parsed.data;
  const id = createId();

  // スラッグの重複チェック
  const existingProject = await db.select().from(projects).where(eq(projects.slug, slug)).get();
  if (existingProject) {
    return { error: { slug: ["このスラッグは既に他のプロジェクトで使用されています。"] } };
  }

  await db.insert(projects).values({
    id,
    slug,
    name,
    description,
    descriptionFormat: descriptionFormat || "markdown",
    type,
    license,
    sourceUrl:  sourceUrl || null,
    links:      links || null,
    iconUrl:    formData.get("iconUrl") as string | null,
    authorId:   session.user.id,
    status:     "draft",
  }).run();

  if (tags.length > 0) {
    await db.insert(projectTags).values(
      tags.map((tag) => ({ projectId: id, tag }))
    ).run();
  }

  revalidatePath("/projects");
  redirect(`/projects/${slug}`);
}

// ─── プロジェクト更新 ─────────────────────────────────────────────────────────

/**
 * 既存のプロジェクト情報を更新する Server Action
 * @param slug 更新対象プロジェクトのSlug
 * @param formData 送信されたフォームデータ
 * @returns { success: boolean } または { error: Record<string, string[]> }
 * @throws Unauthorized ログインしていない場合
 * @throws Forbidden プロジェクトの作者ではない、または管理者権限がない場合
 */
export async function updateProject(projectId: string, formData: FormData) {
  const { db, session } = await getAuthenticatedDb();

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .get();

  if (!project) throw new Error("Project not found");

  await assertProjectAccess(db, project, session);

  const raw = {
    name:        formData.get("name"),
    slug:        formData.get("slug"),
    description: formData.get("description"),
    descriptionFormat: formData.get("descriptionFormat"),
    type:        formData.get("type"),
    license:     formData.get("license"),
    sourceUrl:   formData.get("sourceUrl"),
    links:       formData.get("links"),
    status:      formData.get("status"),
    modrinthId:  formData.get("modrinthId") || null,
    curseforgeId: formData.get("curseforgeId") || null,
    githubRepo:  formData.get("githubRepo") || null,
    discordWebhookUrl: formData.get("discordWebhookUrl") || null,
    issueTrackerUrl: formData.get("issueTrackerUrl") || null,
    tags:        formData.getAll("tags"),
  };

  const parsed = updateProjectSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { tags, githubRepo, discordWebhookUrl, ...fields } = parsed.data;

  // Discord Webhook URL は Discord ホストのみ許可（SSRF/誤設定防止）
  let normalizedWebhook: string | null = null;
  if (discordWebhookUrl) {
    const { isValidDiscordWebhookUrl } = await import("@/lib/notifications/discord");
    if (!isValidDiscordWebhookUrl(discordWebhookUrl)) {
      return { error: { discordWebhookUrl: ["Discord の Webhook URL を入力してください。"] } };
    }
    normalizedWebhook = discordWebhookUrl;
  }

  // GitHub リポジトリは "owner/repo" に正規化して保存（URL 貼り付けも許容）
  let normalizedGithubRepo: string | null = null;
  if (githubRepo) {
    const { normalizeGithubRepo } = await import("@/lib/utils/github");
    normalizedGithubRepo = normalizeGithubRepo(githubRepo);
    if (!normalizedGithubRepo) {
      return { error: { githubRepo: ["'owner/repo' 形式、または GitHub リポジトリの URL を入力してください。"] } };
    }
  }

  // スラッグが変更された場合の重複チェックとpreviousSlugの更新
  let previousSlugToSet: string | undefined = undefined;
  if (fields.slug && fields.slug !== project.slug) {
    const existingSlug = await db.select().from(projects).where(eq(projects.slug, fields.slug)).get();
    if (existingSlug) {
      return { error: { slug: ["このスラッグは既に他のプロジェクトで使用されています。"] } };
    }
    previousSlugToSet = project.slug; // 古いslugを退避
  }

  await db
    .update(projects)
    .set({
      ...fields,
      issueTrackerUrl: fields.issueTrackerUrl !== undefined ? fields.issueTrackerUrl : project.issueTrackerUrl,
      sourceUrl: fields.sourceUrl || null,
      links: fields.links || null,
      githubRepo: normalizedGithubRepo,
      discordWebhookUrl: normalizedWebhook,
      commentsEnabled: formData.get("commentsEnabled") === "on",
      recipesEnabled: formData.get("recipesEnabled") === "on",
      iconUrl:   (formData.get("iconUrl") as string) || project.iconUrl,
      updatedAt: new Date(),
      ...(previousSlugToSet !== undefined ? { previousSlug: previousSlugToSet } : {})
    })
    .where(eq(projects.id, project.id))
    .run();

  if (tags !== undefined) {
    await db.delete(projectTags).where(eq(projectTags.projectId, project.id)).run();
    if (tags.length > 0) {
      await db.insert(projectTags).values(
        tags.map((tag) => ({ projectId: project.id, tag }))
      ).run();
    }
  }

  // ユーザーの提案に従い、自動同期は3日に1回（またはそれ以上の間隔）のみ実行します。
  // これにより、連続編集時のAPI呼び出しの詰まり（メモリ圧迫）を防ぎつつ、定期的な同期を保証します。
  // ※CRON等で分離されたため、ここでのafter()呼び出しは削除しました。

  await maybeNotifyPublish(db, project, fields.slug ?? project.slug, fields.status);

  revalidatePath(`/projects/${fields.slug ?? project.slug}`);
  revalidatePath(`/projects/${fields.slug ?? project.slug}/edit`);
  revalidatePath("/projects");
  return { success: true };
}

// ─── プロジェクト取得（一覧・検索） ─────────────────────────────────────────────

/**
 * 公開中のプロジェクト一覧を取得する Server Action
 * ページネーション、検索クエリ、フィルタリングに対応
 * @param params 検索・フィルタ条件
 * @param params.q 検索文字列（名前、概要にマッチ）
 * @param params.type プロジェクト種別（mod / plugin）
 * @param params.authorId 特定の作者のプロジェクトのみ取得する場合に指定
 * @param params.limit 1ページあたりの取得件数
 * @param params.offset 取得開始位置
 * @param params.sort 並び順
 * @param params.loader ローダーフィルター
 * @param params.mcVersion MCバージョンフィルター
 * @returns projects配列
 */
export async function getProjects(params: {
  q?:    string;
  types?: string[];
  authorId?: string;
  authorUsername?: string;
  limit?: number;
  offset?: number;
  sort?: "downloads" | "newest" | "updated";
  loaders?: string[];
  mcVersions?: string[];
  tags?: string[];
  searchMode?: "AND" | "OR";
  includeDesc?: boolean;
  includeTags?: boolean;
  includeAuthor?: boolean;
  includeExtDl?: boolean;
  calculateTotal?: boolean;
}) {
  const db = await getDatabase();
  const {
    limit = 20, offset = 0, sort = "updated",
    includeExtDl = false, calculateTotal = false
  } = params;

  const conditions = buildProjectSearchConditions(params);
  const orderByExpr = resolveProjectOrderBy(sort, includeExtDl);

  let rows;
  let totalCount = 0;
  try {
    if (calculateTotal) {
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(projects)
        .leftJoin(users, eq(projects.authorId, users.id))
        .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .get();
      totalCount = countResult?.count || 0;
    }

    // プロジェクトと著者の情報をJOINして取得
    const { description, ...restProjects } = getTableColumns(projects);
    rows = await db
      .select({
        project: {
          ...restProjects,
          description: sql<string>`SUBSTR(${projects.description}, 1, 1200) || CASE WHEN LENGTH(${projects.description}) > 1200 THEN '...' ELSE '' END`,
          tagsJson: sql<string>`(SELECT json_group_array(tag) FROM project_tags WHERE project_id = projects.id)`
        },
        author: {
          username: userProfiles.username,
          displayName: userProfiles.displayName,
          avatarUrl: userProfiles.avatarUrl,
        }
      })
      .from(projects)
      .leftJoin(users, eq(projects.authorId, users.id))
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderByExpr)
      .limit(limit)
      .offset(offset)
      .all();
  } catch (err: any) {
    console.error("D1 getProjects Error:");
    console.error("Message:", err.message);
    if (err.cause) console.error("Cause:", err.cause);
    throw err;
  }

  const data = rows.map((row) => {
    let parsedTags: string[] = [];
    if (row.project.tagsJson) {
      try {
        const t = JSON.parse(row.project.tagsJson);
        if (Array.isArray(t) && t.length > 0 && t[0] !== null) {
          parsedTags = t;
        }
      } catch(e) {}
    }
    
    const { tagsJson, ...projectData } = row.project;

    return {
      ...projectData,
      authorUsername: row.author?.username,
      authorDisplayName: row.author?.displayName ?? row.author?.username,
      authorAvatarUrl: row.author?.avatarUrl,
      tags: parsedTags,
    };
  });

  return { data, totalCount };
}

/**
 * プロジェクトのSlugから詳細情報を取得する Server Action
 * @param slug プロジェクトの一意な識別子
 * @returns プロジェクトの詳細データ（作者情報やバージョン情報を含む）。存在しない場合は null。
 */
export async function getProjectBySlug(slug: string) {
  const db = await getDatabase();

  const row = await db
    .select({
      project: projects,
      author: {
        username: userProfiles.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
      },
      sourceIdeaTitle: ideas.title,
    })
    .from(projects)
    .leftJoin(users, eq(projects.authorId, users.id))
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
    .leftJoin(ideas, eq(projects.sourceIdeaId, ideas.id))
    .where(or(eq(projects.slug, slug), eq(projects.previousSlug, slug)))
    .get();

  if (!row) return null;

  const tagsRows = await db.select().from(projectTags).where(eq(projectTags.projectId, row.project.id)).all();
  const versionsRows = await db.select({
    id: versions.id,
    versionNumber: versions.versionNumber,
    releaseChannel: versions.releaseChannel,
    mcVersions: versions.mcVersions,
    loaders: versions.loaders,
    fileName: versions.fileName,
    fileSize: versions.fileSize,
    downloads: versions.downloads,
    createdAt: versions.createdAt,
    projectId: versions.projectId,
    fileUrl: versions.fileUrl,
    fileSha256: versions.fileSha256,
  }).from(versions).where(and(eq(versions.projectId, row.project.id), isNull(versions.archivedAt))).orderBy(desc(versions.createdAt)).limit(20).all();

  return {
    ...row.project,
    author: row.author,
    sourceIdeaTitle: row.sourceIdeaTitle,
    tags: tagsRows.map((t) => t.tag),
    versions: versionsRows,
    redirectSlug: row.project.slug !== slug ? row.project.slug : undefined,
  };
}

/**
 * ユーザーの全公開プロジェクトの総数と総ダウンロード数を取得する Server Action
 */
export async function getUserProjectStats(authorId: string) {
  const db = await getDatabase();
  
  const result = await db
    .select({
      totalProjects: sql<number>`count(*)`,
      nativeDownloads: sql<number>`sum(${projects.downloads})`,
      totalDownloads: sql<number>`sum(${projects.totalDownloads})`,
      modrinthDownloads: sql<number>`sum(COALESCE(json_extract(${projects.externalDownloads}, '$.modrinth'), 0))`,
      curseforgeDownloads: sql<number>`sum(COALESCE(json_extract(${projects.externalDownloads}, '$.curseforge'), 0))`,
    })
    .from(projects)
    .where(and(eq(projects.authorId, authorId), eq(projects.status, "public")))
    .get();

  return {
    totalProjects: result?.totalProjects || 0,
    totalDownloads: result?.totalDownloads || 0,
    nativeDownloads: result?.nativeDownloads || 0,
    modrinthDownloads: result?.modrinthDownloads || 0,
    curseforgeDownloads: result?.curseforgeDownloads || 0,
  };
}

// ─── プロジェクトのアイコン更新 ───────────────────────────────────────────────

export async function updateProjectIcon(projectId: string, iconUrl: string) {
  const { db, session } = await getAuthenticatedDb();

  const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project) throw new Error("Not found");

  await assertProjectAccess(db, project, session);

  await db.update(projects).set({ iconUrl, updatedAt: new Date() }).where(eq(projects.id, projectId));
  revalidatePath(`/[locale]/projects/[slug]`, "page");
  return { success: true };
}

// ─── オーナー権限の譲渡 ───────────────────────────────────────────────────────

export async function transferOwnership(projectId: string, newOwnerId: string) {
  const { db, session } = await getAuthenticatedDb();

  const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project) throw new Error("Not found");

  if (project.authorId !== session.user.id && session.user.role !== "admin") {
    throw new Error("Forbidden: Only owner can transfer ownership");
  }

  // Ensure new owner exists
  const targetUser = await db.select().from(users).where(eq(users.id, newOwnerId)).get();
  if (!targetUser) throw new Error("User not found");

  // Transfer ownership
  await db.update(projects).set({ authorId: newOwnerId, updatedAt: new Date() }).where(eq(projects.id, projectId));

  // The new owner might have been a member, we can safely remove them from members if they are
  await db.delete(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, newOwnerId)));

  revalidatePath(`/[locale]/projects/[slug]/edit`, "page");
  return { success: true };
}

// ─── 一括操作（ステータス変更・削除） ──────────────────────────────────────────

export async function batchUpdateProjectStatus(projectIds: string[], status: "public" | "unlisted" | "private" | "draft") {
  const { db, session } = await getAuthenticatedDb();
  if (!projectIds.length) return { success: true };

  const isOwnerCondition = eq(projects.authorId, session.user.id);
  const conditions = session.user.role === "admin" ? inArray(projects.id, projectIds) : and(inArray(projects.id, projectIds), isOwnerCondition);

  await db.update(projects).set({ status, updatedAt: new Date() }).where(conditions).run();
  
  revalidatePath("/projects");
  revalidatePath("/projects/manage");
  return { success: true };
}

export async function batchDeleteProjects(projectIds: string[]) {
  const { db, session } = await getAuthenticatedDb();
  if (!projectIds.length) return { success: true };

  const isOwnerCondition = eq(projects.authorId, session.user.id);
  const conditions = session.user.role === "admin" ? inArray(projects.id, projectIds) : and(inArray(projects.id, projectIds), isOwnerCondition);

  // プロジェクトを削除（関連データも外部キー制約等でカスケード削除されるか、必要なら手動削除）
  await db.delete(projects).where(conditions).run();

  revalidatePath("/projects");
  revalidatePath("/projects/manage");
  return { success: true };
}

export async function syncExternalProjectDataSystem(db: any, project: any, settings: any) {
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
      // Studios コンソールキーは運営が env で全体設定する共通シークレット
      const rawCfApiKey = process.env.CURSEFORGE_FOR_STUDIOS_API_KEY;
      if (rawCfApiKey) {
        const cfApiKey = rawCfApiKey.trim();
        let targetCfId = project.curseforgeId;
        
        // Slugの場合は検索してIDを取得
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
              // Slugを実際のIDに変換してDBに保存しておく
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
        // APIキーがない場合のフォールバック（CFWidget API）
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
          // Slugのみの場合はCFWidgetで引けないためエラー
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
}

export async function syncExternalProjectData(projectId: string) {
  const { db, session } = await getAuthenticatedDb();
  
  const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project) throw new Error("Project not found");

  await assertProjectAccess(db, project, session);

  const settings = await db.query.userSettings.findFirst({ where: eq(userSettings.userId, session.user.id) });
  
  const newExtDl = await syncExternalProjectDataSystem(db, project, settings);
  
  revalidatePath(`/projects/${project.slug}`);
  return { success: true, externalDownloads: newExtDl };
}
