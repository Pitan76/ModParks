"use server";

import { auth } from "@/lib/auth";
import { getDb, getD1 } from "@/lib/db";
import { versions, projects } from "@/db/schema";
import { createVersionSchema } from "@/lib/validations";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createVersion(projectSlug: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const d1 = await getD1();
  const db = getDb(d1);

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.slug, projectSlug))
    .get();

  if (!project) throw new Error("Project not found");
  if (project.authorId !== session.user.id) throw new Error("Forbidden");

  const raw = {
    versionNumber: formData.get("versionNumber"),
    mcVersions:    formData.getAll("mcVersions"),
    loaders:       formData.getAll("loaders"),
    changelog:     formData.get("changelog"),
  };

  const parsed = createVersionSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const fileUrl  = formData.get("fileUrl") as string;
  const fileName = formData.get("fileName") as string;

  if (!fileUrl || !fileName) {
    return { error: { fileUrl: ["ファイルをアップロードしてください"] } };
  }

  const id = createId();

  await db.insert(versions).values({
    id,
    versionNumber: parsed.data.versionNumber,
    mcVersions:    JSON.stringify(parsed.data.mcVersions),
    loaders:       JSON.stringify(parsed.data.loaders),
    changelog:     parsed.data.changelog,
    fileUrl,
    fileName,
    fileSize:      formData.get("fileSize") ? Number(formData.get("fileSize")) : null,
    fileSha256:    formData.get("fileSha256") as string | null,
    projectId:     project.id,
  }).run();

  revalidatePath(`/projects/${projectSlug}`);
  return { success: true, versionId: id };
}
