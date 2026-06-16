import { getDatabase } from "@/lib/db";
import { ideas, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import Typography from "@mui/material/Typography";
import { getTranslations, setRequestLocale } from "next-intl/server";
import IdeasClient from "./IdeasClient";

export default async function AdminIdeasPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tAdmin = await getTranslations("Admin.ideas");

  const db = await getDatabase();
  const allIdeas = await db
    .select({
      id: ideas.id,
      title: ideas.title,
      status: ideas.status,
      createdAt: ideas.createdAt,
      authorUsername: users.username,
      authorDisplayName: users.displayName,
    })
    .from(ideas)
    .leftJoin(users, eq(ideas.authorId, users.id))
    .orderBy(desc(ideas.createdAt))
    .all();

  return (
    <>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: "bold" }}>
        {tAdmin("title")}
      </Typography>
      <IdeasClient ideas={allIdeas} />
    </>
  );
}
