import { getDatabase } from "@/lib/db";
import { tags as tagsSchema, users } from "@/db/schema";
import NewProjectForm from "@/components/project/NewProjectForm";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export default async function NewProjectPage() {
  const db = await getDatabase();
  const availableTags = await db.select().from(tagsSchema).all();
  
  const session = await auth();
  let defaultLicense = "All Rights Reserved";
  if (session?.user?.id) {
    const userRecord = await db.select().from(users).where(eq(users.id, session.user.id)).get();
    if (userRecord?.defaultLicense) {
      defaultLicense = userRecord.defaultLicense;
    }
  }

  return <NewProjectForm availableTags={availableTags} defaultLicense={defaultLicense} />;
}
