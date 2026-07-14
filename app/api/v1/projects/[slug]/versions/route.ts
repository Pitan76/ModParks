import { NextResponse } from "next/server";
import { getDb, getD1, type Env } from "@/lib/db";
import { projects, versions, projectMembers, versionLoaders, versionMcVersions } from "@/db/schema";
import { validateApiKey } from "@/lib/api-auth";
import { eq, desc, and } from "drizzle-orm";
import { ApiVersion } from "@/types/api";
import { createVersionSchema, isAllowedExternalUrl } from "@/lib/validations";
import { createId } from "@paralleldrive/cuid2";
import { buildR2Key, getR2PublicUrl, uploadToR2 } from "@/lib/r2";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { revalidatePath } from "next/cache";
import { withPublicCache } from "@/lib/http/cache";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const d1 = await getD1();
  const db = getDb(d1);

  const { slug } = await params;

  const [project] = await db.select({ id: projects.id, status: projects.status, authorId: projects.authorId }).from(projects).where(eq(projects.slug, slug)).limit(1);
  
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.status !== "public") {
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

  const results = await db
    .select()
    .from(versions)
    .where(eq(versions.projectId, project.id))
    .orderBy(desc(versions.createdAt));

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
    fileUrl: `/api/download?versionId=${v.id}`
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

  const [project] = await db.select().from(projects).where(eq(projects.slug, slug)).limit(1);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Permission check
  if (project.authorId !== auth.userId) {
    const member = await db.select().from(projectMembers).where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, auth.userId))).limit(1);
    if (member.length === 0) {
      return NextResponse.json({ error: "Forbidden: You don't have permission to upload to this project" }, { status: 403 });
    }
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
      // Handle array or comma-separated string
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
    createdAt: new Date(),
  }).run();

  if (parsed.data.loaders && parsed.data.loaders.length > 0) {
    const loaderValues = parsed.data.loaders.map(loader => ({
      versionId: id,
      loader,
    }));
    await db.insert(versionLoaders).values(loaderValues).run();
  }

  if (parsed.data.mcVersions && parsed.data.mcVersions.length > 0) {
    const mcValues = parsed.data.mcVersions.map(mc => ({
      versionId: id,
      mcVersion: mc,
    }));
    await db.insert(versionMcVersions).values(mcValues).run();
  }

  revalidatePath(`/projects/${project.slug}`);

  return NextResponse.json({ success: true, versionId: id }, { status: 201 });
}
