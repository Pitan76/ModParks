import { getDatabase } from "@/lib/db";
import { projects, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import Typography from "@mui/material/Typography";
import { getTranslations, setRequestLocale } from "next-intl/server";
import ProjectsClient from "./ProjectsClient";

export default async function AdminProjectsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tAdmin = await getTranslations("Admin.projects");

  const db = await getDatabase();
  const allProjects = await db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      createdAt: projects.createdAt,
      authorUsername: users.username,
      authorDisplayName: users.displayName,
    })
    .from(projects)
    .leftJoin(users, eq(projects.authorId, users.id))
    .orderBy(desc(projects.createdAt))
    .all();

  return (
    <>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: "bold" }}>
        {tAdmin("title")}
      </Typography>
      <ProjectsClient projects={allProjects} />
    </>
  );
}
