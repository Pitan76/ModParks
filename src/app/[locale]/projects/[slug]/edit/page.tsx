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
import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { versions, posts, ideas, versionIdeas, userSettings } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
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

  const openIdeas = await db
    .select({ id: posts.id, title: posts.title })
    .from(ideas)
    .innerJoin(posts, eq(posts.id, ideas.id))
    .where(inArray(ideas.status, ["open", "in_progress"]))
    .all();

  const dependencies = await getProjectDependencies(project.id);
  const media = await getPublicProjectMedia(project.id);

  // Modrinth/CurseForge への一括バージョン反映は、連携済みプロジェクトかつ閲覧者本人が
  // それぞれのAPIキー/トークンを設定している場合のみ提供する
  const viewerSettings = await db
    .select({ modrinthApiKey: userSettings.modrinthApiKey, curseforgeUploadApiToken: userSettings.curseforgeUploadApiToken })
    .from(userSettings)
    .where(eq(userSettings.userId, session.user.id))
    .get();
  const modrinthSyncAvailable = !!project.modrinthId && !!viewerSettings?.modrinthApiKey;
  const curseforgeSyncAvailable = !!project.curseforgeId && !!viewerSettings?.curseforgeUploadApiToken;

  const { getAvailableTags, getAvailablePlatforms } = await import("@/lib/queries/masterData");
  const [availableTags, availablePlatforms] = await Promise.all([
    getAvailableTags(),
    getAvailablePlatforms(),
  ]);

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
        versionsManager={<ProjectVersionsManager projectSlug={project.slug} versions={projectVersions} openIdeas={openIdeas} availablePlatforms={availablePlatforms} githubRepo={project.githubRepo} modrinthSyncAvailable={modrinthSyncAvailable} curseforgeSyncAvailable={curseforgeSyncAvailable} />}
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
          <ProjectDependenciesManager projectId={project.id} dependencies={dependencies} availablePlatforms={availablePlatforms} />
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
