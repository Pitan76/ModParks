import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { notFound, redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getProjectBySlug } from "@/lib/actions/project";
import ProjectEditForm from "@/components/project/ProjectEditForm";
import ProjectMembersManager from "@/components/project/ProjectMembersManager";
import ProjectOwnershipTransfer from "@/components/project/ProjectOwnershipTransfer";
import { getProjectMembers } from "@/lib/actions/member";
import Box from "@mui/material/Box";

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

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 800,  mb: 4  }}>
        {t("managePage.title")}
      </Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: "bold", mb: 2 }}>
            基本情報
          </Typography>
          <ProjectEditForm project={project} />
        </Box>

        <ProjectMembersManager 
          projectId={project.id} 
          members={members} 
          isOwner={isOwner} 
          currentUserId={session.user.id} 
        />

        {isOwner && (
          <ProjectOwnershipTransfer projectId={project.id} />
        )}
      </Box>
    </Container>
  );
}
