import { getAdminDb } from "@/lib/auth-helpers";
import { posts, projects, users, userProfiles } from "@/db/schema";
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
      name: posts.title,
      slug: posts.slug,
      createdAt: posts.createdAt,
      authorUsername: userProfiles.username,
      authorDisplayName: userProfiles.displayName,
    })
    .from(projects)
    .innerJoin(posts, eq(projects.id, posts.id)) // project と post をidでくっつける
    .leftJoin(users, eq(posts.authorId, users.id)) // user がいない（削除済みなど）可能性もあるのでleftJoin
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId)) // userProfiles がいない可能性もあるのでleftJoin
    .orderBy(desc(posts.createdAt))
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
