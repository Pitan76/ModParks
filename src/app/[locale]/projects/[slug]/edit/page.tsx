import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Breadcrumb from "@/components/ui/Breadcrumb";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getProjectBySlug } from "@/lib/actions/projectQuery";
import ProjectEditForm from "@/components/project/ProjectEditForm";
import ProjectDescriptionForm from "@/components/project/ProjectDescriptionForm";
import ProjectMembersManager from "@/components/project/ProjectMembersManager";
import ProjectOwnershipTransfer from "@/components/project/ProjectOwnershipTransfer";
import ProjectVersionsManager from "@/components/project/ProjectVersionsManager";
import ProjectMediaManager from "@/components/project/ProjectMediaManager";
import { getPublicProjectMedia } from "@/lib/queries/projectMedia";
import ProjectEditClient from "@/components/project/ProjectEditClient";
import ProjectDependenciesManager from "@/components/project/ProjectDependenciesManager";
import { getProjectMembers } from "@/lib/actions/member";
import { getProjectDependencies } from "@/lib/queries/dependency";
import { loadVersionUploadContext } from "@/lib/queries/versionUploadContext";
import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { versions, posts, versionIdeas } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { displayDownloadsSql } from "@/lib/queries/versionList";
import { isAdminSession } from "@/lib/auth/roles";
import { redirect } from "@/lib/i18n/routing";

interface EditProjectPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function EditProjectPage({ params }: EditProjectPageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/login", locale: locale });
  }

  const project = await getProjectBySlug(slug);

  if (!project) notFound();

  if (project.redirectSlug) {
    redirect({ href: `/projects/${project.redirectSlug}/edit`, locale: locale });
  }

  const members = await getProjectMembers(project.id);
  const isOwner = project.authorId === session.user.id;
  const isMember = members.some(m => m.id === session.user.id);

  // 権限チェック (オーナー、メンバー、または管理者のみ編集可能)
  if (!isOwner && !isMember && !isAdminSession(session)) {
    redirect({ href: `/projects/${slug}`, locale: locale });
  }

  const t = await getTranslations("Project");
  const tCommon = await getTranslations("Common");

  const { db } = await getAuthenticatedDb();
  const rawVersions = await db
    .select({
      id: versions.id,
      versionNumber: versions.versionNumber,
      mcVersions: versions.mcVersions,
      loaders: versions.loaders,
      createdAt: versions.createdAt,
      downloads: displayDownloadsSql,
      changelog: versions.changelog,
      releaseChannel: versions.releaseChannel,
      fileUrl: versions.fileUrl,
      archivedAt: versions.archivedAt,
      projectId: versions.projectId,
      uploaderId: versions.uploaderId,
      ideaId: versionIdeas.ideaId,
      ideaTitle: posts.title,
    })
    .from(versions)
    .leftJoin(versionIdeas, eq(versions.id, versionIdeas.versionId))
    .leftJoin(posts, eq(versionIdeas.ideaId, posts.id))
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

  const dependencies = await getProjectDependencies(project.id);
  const media = await getPublicProjectMedia(project.id);

  // バージョン追加フォームの前提はページ側と同じローダーから取る（渡し漏れを防ぐため）
  const uploadContext = await loadVersionUploadContext(db, project, session.user.id);

  const { getAvailableTags } = await import("@/lib/queries/masterData");
  const availableTags = await getAvailableTags();

  return (
    <Container maxWidth="md" sx={{ pt: 1, pb: 3 }}>
      <Breadcrumb
        items={[
          { label: tCommon("projects"), href: "/projects" },
          { label: project.title, href: `/projects/${project.slug}` },
          { label: t("manage") },
        ]}
      />

      <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mb: 1 }}>
        {t("managePage.title", { name: project.title })}
      </Typography>

      <ProjectEditClient
        isOwner={isOwner}
        basicInfoForm={<ProjectEditForm project={project} availableTags={availableTags} />}
        descriptionForm={<ProjectDescriptionForm project={project} />}
        versionsManager={<ProjectVersionsManager versions={projectVersions} githubRepo={project.githubRepo} uploadContext={uploadContext} />}
        mediaManager={<ProjectMediaManager projectId={project.id} projectSlug={project.slug} media={media} />}
        membersManager={
          <ProjectMembersManager 
            projectId={project.id} 
            members={members} 
            isOwner={isOwner} 
            currentUserId={session.user.id} 
          />
        }
        dependenciesManager={
          <ProjectDependenciesManager projectId={project.id} dependencies={dependencies} availablePlatforms={uploadContext.availablePlatforms} />
        }
        projectId={project.id}
        projectSlug={project.slug}
        recipeNamespaces={project.recipeNamespaces}
        recipeSettings={project.recipeSettings}
        locale={locale}
        ownershipTransfer={<ProjectOwnershipTransfer projectId={project.id} />}
      />
    </Container>
  );
}
