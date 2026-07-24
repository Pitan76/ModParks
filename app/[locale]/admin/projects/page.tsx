import { getAdminDb } from "@/lib/auth-helpers";
import { projects, users, userProfiles } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import Typography from "@mui/material/Typography";
import { getTranslations, setRequestLocale } from "next-intl/server";
import ProjectsClient from "./ProjectsClientLazy";

export default async function AdminProjectsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tAdmin = await getTranslations("Admin.projects");

  const { db } = await getAdminDb();
  const allProjects = await db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      createdAt: projects.createdAt,
      authorUsername: userProfiles.username,
      authorDisplayName: userProfiles.displayName,
    })
    .from(projects)
    .leftJoin(users, eq(projects.authorId, users.id))
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
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
