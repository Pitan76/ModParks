import { getDatabase } from "@/lib/db";
import { tags as tagsSchema, userSettings } from "@/db/schema";
import NewProjectForm from "@/components/project/NewProjectForm";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const db = await getDatabase();
  const availableTags = await db.select().from(tagsSchema).all();
  
  const session = await auth();
  let defaultLicense = "All Rights Reserved";
  let hasModrinthKey = false;
  let hasCurseForgeKey = false;

  if (session?.user?.id) {
    const settingsRecord = await db.select().from(userSettings).where(eq(userSettings.userId, session.user.id)).get();
    if (settingsRecord?.defaultLicense) {
      defaultLicense = settingsRecord.defaultLicense;
    }
    hasModrinthKey = !!settingsRecord?.modrinthApiKey;
    // CF の単体URLインポートは運営設定の共通コンソールキーを使うため、サーバー側の設定有無で判定
    hasCurseForgeKey = !!(process.env.CURSEFORGE_FOR_STUDIOS_API_KEY);
  }

  const resolvedParams = await searchParams;
  const ideaId = typeof resolvedParams.ideaId === "string" ? resolvedParams.ideaId : undefined;

  return (
    <NewProjectForm 
      availableTags={availableTags} 
      defaultLicense={defaultLicense} 
      ideaId={ideaId}
      hasModrinthKey={hasModrinthKey}
      hasCurseForgeKey={hasCurseForgeKey}
    />
  );
}
