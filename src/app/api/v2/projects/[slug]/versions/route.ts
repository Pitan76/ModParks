import { NextResponse, after } from "next/server";
import { getDb, getD1, type Env } from "@/lib/db";
import { posts, projects, projectDependencies, versions, projectMembers, versionLoaders, versionMcVersions } from "@/db/schema";
import { validateApiKey } from "@/lib/api-auth";
import { eq, desc, and, getTableColumns, isNull } from "drizzle-orm";
import { displayDownloadsSql } from "@/lib/queries/versionList";
import { dependencyAppliesToLoaders, parseDependencyLoaders } from "@/lib/dependencies/scope";
import type { ApiVersion, ApiVersionDependency } from "@/types/api";
import { createVersionSchema, isAllowedExternalUrl } from "@/lib/validations";
import { createId } from "@paralleldrive/cuid2";
import { buildR2Key, getR2PublicUrl, uploadToR2 } from "@/lib/r2";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { extractRecipes } from "@/lib/services/jar";
import { revalidatePath } from "next/cache";
import { withPublicCache } from "@/lib/http/cache";
import { findProjectPostBySlug } from "@/lib/queries/post";
import { canManagePost } from "@/lib/auth/postAccess";
import { isAllowedUpload } from "@/lib/upload/fileTypes";
import { getTrustState } from "@/lib/services/trust";
import { scanVersionFile } from "@/lib/actions/versionScan";
import { notifyNewVersion } from "@/lib/notifications/notify";

/**
 * バージョンには title/body 系のリネーム対象フィールドが無いため、
 * ApiVersion 自体は v1/v2 で同一。変わるのは Project 参照の取り方だけ。
 */

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const d1 = await getD1();
  const db = getDb(d1);

  const { slug } = await params;

  const project = await findProjectPostBySlug(db, slug);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.visibility !== "public") {
    const auth = await validateApiKey(request);
    if (!auth.valid || !auth.userId) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.authorId !== auth.userId) {
      const member = await db.select().from(projectMembers).where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, auth.userId))).limit(1);
      if (member.length === 0) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }
  }

  const [results, dependencyRows] = await Promise.all([
    db
      .select({
        ...getTableColumns(versions),
        // 累積カウンタに未反映の分を足す。画面と同じ数字を返すため
        downloads: displayDownloadsSql,
      })
      .from(versions)
      .where(and(eq(versions.projectId, project.id), isNull(versions.archivedAt)))
      .orderBy(desc(versions.createdAt)),
    db
      .select({
        versionId: projectDependencies.versionId,
        dependencyType: projectDependencies.dependencyType,
        externalUrl: projectDependencies.externalUrl,
        externalName: projectDependencies.externalName,
        loaders: projectDependencies.loaders,
        targetSlug: posts.slug,
        targetTitle: posts.title,
      })
      .from(projectDependencies)
      .leftJoin(projects, eq(projectDependencies.targetProjectId, projects.id))
      .leftJoin(posts, eq(posts.id, projects.id))
      .where(eq(projectDependencies.projectId, project.id))
      .all(),
  ]);

  const toApiDependency = (d: typeof dependencyRows[number]): ApiVersionDependency => ({
    dependencyType: d.dependencyType,
    projectSlug: d.targetSlug ?? null,
    projectTitle: d.targetTitle ?? null,
    externalUrl: d.externalUrl,
    externalName: d.externalName,
    versionScoped: !!d.versionId,
    loaders: parseDependencyLoaders(d.loaders),
  });

  const data: ApiVersion[] = results.map(v => ({
    id: v.id,
    versionNumber: v.versionNumber,
    changelog: v.changelog,
    releaseChannel: v.releaseChannel,
    fileSize: v.fileSize,
    fileSha256: v.fileSha256,
    fileName: v.fileName,
    downloads: v.downloads,
    createdAt: v.createdAt ? new Date(v.createdAt).getTime() : 0,
    loaders: JSON.parse(v.loaders),
    mcVersions: JSON.parse(v.mcVersions),
    fileUrl: `/api/download?versionId=${v.id}`,
    // バージョン限定のものと、プロジェクト全体のものを両方返す。
    // 全体側にプラットフォーム指定があるものは、そのバージョンのローダーに合うものだけ
    dependencies: dependencyRows
      .filter((d) => d.versionId === null || d.versionId === v.id)
      .filter((d) => dependencyAppliesToLoaders(parseDependencyLoaders(d.loaders), JSON.parse(v.loaders)))
      .map(toApiDependency),
  }));

  return withPublicCache(NextResponse.json({ data }));
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await validateApiKey(request);
  if (!auth.valid || !auth.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const d1 = await getD1();
  const db = getDb(d1);
  const { slug } = await params;

  const project = await findProjectPostBySlug(db, slug);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  let memberIds: string[] | undefined;
  if (project.authorId !== auth.userId) {
    const member = await db.select({ userId: projectMembers.userId }).from(projectMembers).where(eq(projectMembers.projectId, project.id)).all();
    memberIds = member.map((m: { userId: string }) => m.userId);
  }
  if (!canManagePost({ ...project, memberIds }, { userId: auth.userId, isAdmin: false })) {
    return NextResponse.json({ error: "Forbidden: You don't have permission to upload to this project" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const parseArrayField = (key: string): string[] => {
    const values = formData.getAll(key);
    if (values.length > 0) {
      const flat = values.flatMap(v => String(v).split(",").map(s => s.trim()).filter(Boolean));
      return flat;
    }
    return [];
  };

  const raw = {
    versionNumber: formData.get("versionNumber"),
    mcVersions: parseArrayField("mcVersions"),
    loaders: parseArrayField("loaders"),
    changelog: formData.get("changelog") || "",
    releaseChannel: formData.get("releaseChannel") ?? undefined,
  };

  const parsed = createVersionSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  let fileUrl = formData.get("fileUrl") as string;
  let fileName = formData.get("fileName") as string;
  let fileSize = formData.get("fileSize") ? Number(formData.get("fileSize")) : null;

  const file = formData.get("file") as File | null;

  if (!file && !fileUrl) {
    return NextResponse.json({ error: "file or fileUrl is required" }, { status: 400 });
  }

  if (file) {
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds 5MB limit" }, { status: 413 });
    }

    const trustState = await getTrustState(auth.userId);
    const userTier = trustState.tier;

    if (!isAllowedUpload("mod", file.type || "", file.name, project.type, userTier)) {
      const name = file.name.toLowerCase();
      const isExeOrSimilar =
        name.endsWith(".exe") ||
        name.endsWith(".msi") ||
        name.endsWith(".dmg") ||
        name.endsWith(".app");

      if (isExeOrSimilar && project.type === "other" && !(userTier === "member" || userTier === "trusted" || userTier === "veteran")) {
        return NextResponse.json({ error: "Only users with Member tier or higher can upload executable files (e.g. .exe)." }, { status: 403 });
      }

      const allowedMsg = project.type === "other"
        ? "Only .jar, .zip, .exe, .msi, .dmg, and .app files are allowed (executables require Member tier)."
        : "Only .jar and .zip files are allowed.";
      return NextResponse.json({ error: `Invalid file type. ${allowedMsg}` }, { status: 400 });
    }

    let R2: R2Bucket;
    if (process.env.NODE_ENV === "development" && typeof process !== "undefined" && process.release?.name === "node") {
      const { getCachedPlatformProxy } = await import("@/lib/proxy");
      const proxy = await getCachedPlatformProxy();
      R2 = proxy.env.modparks_storage;
    } else {
      const { env } = await getCloudflareContext({ async: true });
      R2 = (env as unknown as Env).modparks_storage;
    }

    if (!R2) {
      return NextResponse.json({ error: "R2 binding not found" }, { status: 500 });
    }

    const uniqueId = createId();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = buildR2Key("mod", project.slug, `${uniqueId}/${safeFileName}`);

    try {
      const arrayBuffer = await file.arrayBuffer();
      await uploadToR2(R2, key, arrayBuffer, file.type || "application/java-archive");
      fileUrl = getR2PublicUrl(key);
      fileName = file.name;
      fileSize = file.size;

      const shouldExtract = formData.get("extractRecipes") === "true";
      if (shouldExtract && (file.name.endsWith(".jar") || file.name.endsWith(".zip"))) {
        try {
          const cdnUrl = process.env.NEXT_PUBLIC_RECIPE_CDN_URL || "https://recipe.modparks.pitan76.net";
          const useCdnApi = process.env.USE_RECIPE_CDN_API === "true";
          const { count } = await extractRecipes({ kind: "r2", key }, cdnUrl, useCdnApi);
          console.log(`Extracted and uploaded ${count} recipe/tag/texture files (CDN API: ${useCdnApi}).`);
        } catch (zipErr) {
          console.error("Failed to extract recipes from jar:", zipErr);
        }
      }
    } catch (err: any) {
      console.error("Upload Error:", err);
      return NextResponse.json({ error: "Failed to upload file to R2" }, { status: 500 });
    }
  } else if (fileUrl) {
    if (!fileName) {
      fileName = fileUrl.split("/").pop() || "external-file";
    }
    if (!isAllowedExternalUrl(fileUrl)) {
      return NextResponse.json({ error: "Invalid external URL domain" }, { status: 400 });
    }
  }

  const id = createId();

  await db.insert(versions).values({
    id,
    versionNumber: parsed.data.versionNumber,
    mcVersions: JSON.stringify(parsed.data.mcVersions),
    loaders: JSON.stringify(parsed.data.loaders),
    changelog: parsed.data.changelog || "",
    releaseChannel: parsed.data.releaseChannel,
    fileUrl,
    fileName,
    fileSize,
    fileSha256: formData.get("fileSha256") as string | null,
    projectId: project.id,
    // 信頼スコアの加点・減点は実行者本人に効かせる必要がある。
    // 省くと trustProjection / trustModeration が投稿者へフォールバックし、
    // メンバーが API から上げたファイルの責任がオーナーに乗る
    uploaderId: auth.userId,
    createdAt: new Date(),
  }).run();

  // バージョン追加はプロジェクトの更新とみなす
  await db.update(posts).set({ updatedAt: new Date() }).where(eq(posts.id, project.id)).run();

  if (parsed.data.loaders && parsed.data.loaders.length > 0) {
    await db.insert(versionLoaders).values(parsed.data.loaders.map(loader => ({ versionId: id, loader }))).run();
  }

  if (parsed.data.mcVersions && parsed.data.mcVersions.length > 0) {
    await db.insert(versionMcVersions).values(parsed.data.mcVersions.map(mc => ({ versionId: id, mcVersion: mc }))).run();
  }

  // UI 経由（lib/actions/version.ts）と同じ検査・通知を必ず通す。
  // 検査を省くと scan_status が pending のまま配布され、
  // /api/download の malicious 遮断をすり抜ける
  after(async () => {
    await scanVersionFile(db, id, fileUrl, fileName);
    await notifyNewVersion(db, project, parsed.data.versionNumber);
  });

  revalidatePath(`/projects/${project.slug}`);

  return NextResponse.json({ success: true, versionId: id }, { status: 201 });
}
