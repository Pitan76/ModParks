import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import HomeIcon from "@mui/icons-material/Home";
import { Link } from "@/i18n/routing";
import { notFound, redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getProjectBySlug } from "@/lib/actions/projectQuery";
import ProjectEditForm from "@/components/project/ProjectEditForm";
import ProjectMembersManager from "@/components/project/ProjectMembersManager";
import ProjectOwnershipTransfer from "@/components/project/ProjectOwnershipTransfer";
import ProjectVersionsManager from "@/components/project/ProjectVersionsManager";
import ProjectEditClient from "@/components/project/ProjectEditClient";
import ProjectDependenciesManager from "@/components/project/ProjectDependenciesManager";
import { getProjectMembers } from "@/lib/actions/member";
import { getProjectDependencies } from "@/lib/actions/dependency";
import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { versions, ideas } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";

interface EditProjectPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function EditProjectPage({ params }: EditProjectPageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const project = await getProjectBySlug(slug);

  if (!project) {
    notFound();
  }

  if (project.redirectSlug) {
    redirect(`/${locale}/projects/${project.redirectSlug}/edit`);
  }

  const members = await getProjectMembers(project.id);
  const isOwner = project.authorId === session.user.id;
  const isMember = members.some(m => m.id === session.user.id);

  // 権限チェック (オーナー、メンバー、または管理者のみ編集可能)
  if (!isOwner && !isMember && session.user.role !== "admin") {
    redirect(`/projects/${slug}`);
  }

  const t = await getTranslations("Project");
  const tNav = await getTranslations("Nav");

  const { db } = await getAuthenticatedDb();
  const rawVersions = await db
    .select()
    .from(versions)
    .where(eq(versions.projectId, project.id))
    .orderBy(desc(versions.createdAt))
    .all();

  // レシピ/テクスチャ抽出は R2 に実体があるファイルのみ可能。
  // R2_PUBLIC_URL はサーバー専用envのため、可否をここで算出してクライアントに渡す。
  const { getR2KeyFromUrl } = await import("@/lib/r2");
  const projectVersions = rawVersions.map((v) => ({
    ...v,
    isExternal: !!v.fileUrl && getR2KeyFromUrl(v.fileUrl) === null,
    canExtractRecipes: !!v.fileUrl,
  }));

  const openIdeas = await db
    .select({ id: ideas.id, title: ideas.title })
    .from(ideas)
    .where(inArray(ideas.status, ["open", "in_progress"]))
    .all();

  const dependencies = await getProjectDependencies(project.id);

  const { getAvailableTags, getAvailablePlatforms } = await import("@/lib/queries/masterData");
  const [availableTags, availablePlatforms] = await Promise.all([
    getAvailableTags(),
    getAvailablePlatforms(),
  ]);

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      {/* パンくずリスト */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, typography: "body2", color: "text.secondary", flexWrap: "wrap", minWidth: 0 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", color: "inherit", textDecoration: "none" }}>
            <HomeIcon fontSize="small" style={{ color: "inherit" }} />
          </Link>
          <span>/</span>
          <Link href="/projects" style={{ color: "inherit", textDecoration: "none" }}>
            {tNav("projects")}
          </Link>
          <span>/</span>
          <Link href={`/projects/${project.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
            {project.name}
          </Link>
          <span>/</span>
          <Typography variant="body2" color="text.primary" sx={{ fontWeight: 500 }}>
            {t("manage")}
          </Typography>
        </Box>
      </Box>

      <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mb: 4 }}>
        {t("managePage.title", { name: project.name })}
      </Typography>

      <ProjectEditClient
        isOwner={isOwner}
        basicInfoForm={<ProjectEditForm project={project} availableTags={availableTags} />}
        versionsManager={<ProjectVersionsManager projectSlug={project.slug} versions={projectVersions} openIdeas={openIdeas} availablePlatforms={availablePlatforms} githubRepo={project.githubRepo} />}
        membersManager={
          <ProjectMembersManager 
            projectId={project.id} 
            members={members} 
            isOwner={isOwner} 
            currentUserId={session.user.id} 
          />
        }
        dependenciesManager={
          <ProjectDependenciesManager projectId={project.id} dependencies={dependencies} />
        }
        ownershipTransfer={<ProjectOwnershipTransfer projectId={project.id} />}
      />
    </Container>
  );
}
