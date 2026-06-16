import { getDatabase } from "@/lib/db";
import { tags as tagsSchema } from "@/db/schema";
import NewProjectForm from "@/components/project/NewProjectForm";

export default async function NewProjectPage() {
  const db = await getDatabase();
  const availableTags = await db.select().from(tagsSchema).all();

  return <NewProjectForm availableTags={availableTags} />;
}
