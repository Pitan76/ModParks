import { getAdminDb } from "@/lib/auth-helpers";
import { posts, projects, users, userProfiles } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import Typography from "@mui/material/Typography";
import { getTranslations, setRequestLocale } from "next-intl/server";
import ProjectsClient from "./ProjectsClientLazy";
import PaginationControls from "@/components/ui/PaginationControls";

const ADMIN_PROJECTS_PER_PAGE = 50;

interface AdminProjectsPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; limit?: string }>;
}

export default async function AdminProjectsPage({ params, searchParams }: AdminProjectsPageProps) {
  const { locale } = await params;
  const { page: pageStr, limit: limitStr } = await searchParams;
  setRequestLocale(locale);
  const tAdmin = await getTranslations("Admin.projects");

  const { db } = await getAdminDb();

  const page = Math.max(1, parseInt(pageStr as string) || 1);
  const limit = Math.min(Math.max(parseInt(limitStr as string) || ADMIN_PROJECTS_PER_PAGE, 10), 200);
  const offset = (page - 1) * limit;

  const [allProjects, countResult] = await Promise.all([
    db
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
      .limit(limit)
      .offset(offset)
      .all(),
    db.select({ count: sql<number>`count(*)` }).from(projects).get(),
  ]);
  const totalCount = countResult?.count ?? 0;

  return (
    <>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: "bold" }}>
        {tAdmin("title")}
      </Typography>
      <ProjectsClient projects={allProjects} />
      {totalCount > 0 && (
        <PaginationControls totalCount={totalCount} currentPage={page} currentLimit={limit} sx={{ mt: 3 }} />
      )}
    </>
  );
}
