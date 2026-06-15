import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { notFound, redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getProjectBySlug } from "@/lib/actions/project";
import ProjectEditForm from "@/components/project/ProjectEditForm";
import ProjectMembersManager from "@/components/project/ProjectMembersManager";
import ProjectOwnershipTransfer from "@/components/project/ProjectOwnershipTransfer";
import ProjectVersionsManager from "@/components/project/ProjectVersionsManager";
import ProjectEditClient from "@/components/project/ProjectEditClient";
import { getProjectMembers } from "@/lib/actions/member";
import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { versions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

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

  const members = await getProjectMembers(project.id);
  const isOwner = project.authorId === session.user.id;
  const isMember = members.some(m => m.id === session.user.id);

  // 権限チェック (オーナー、メンバー、または管理者のみ編集可能)
  if (!isOwner && !isMember && session.user.role !== "admin") {
    redirect(`/projects/${slug}`);
  }

  const t = await getTranslations("Project");

  const { db } = await getAuthenticatedDb();
  const projectVersions = await db
    .select()
    .from(versions)
    .where(eq(versions.projectId, project.id))
    .orderBy(desc(versions.createdAt))
    .all();

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mb: 4 }}>
        {t("managePage.title")}
      </Typography>

      <ProjectEditClient
        isOwner={isOwner}
        basicInfoForm={<ProjectEditForm project={project} />}
        versionsManager={<ProjectVersionsManager projectSlug={project.slug} versions={projectVersions} />}
        membersManager={
          <ProjectMembersManager 
            projectId={project.id} 
            members={members} 
            isOwner={isOwner} 
            currentUserId={session.user.id} 
          />
        }
        ownershipTransfer={<ProjectOwnershipTransfer projectId={project.id} />}
      />
    </Container>
  );
}
