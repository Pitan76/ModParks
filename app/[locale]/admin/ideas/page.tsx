import { getAdminDb } from "@/lib/auth-helpers";
import { ideas, users, userProfiles } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import Typography from "@mui/material/Typography";
import { getTranslations, setRequestLocale } from "next-intl/server";
import IdeasClient from "./IdeasClientLazy";

export default async function AdminIdeasPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tAdmin = await getTranslations("Admin.ideas");

  const { db } = await getAdminDb();
  const allIdeas = await db
    .select({
      id: ideas.id,
      title: ideas.title,
      status: ideas.status,
      createdAt: ideas.createdAt,
      authorUsername: userProfiles.username,
      authorDisplayName: userProfiles.displayName,
    })
    .from(ideas)
    .leftJoin(users, eq(ideas.authorId, users.id))
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
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
