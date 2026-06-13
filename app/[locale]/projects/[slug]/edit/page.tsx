import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getProjectBySlug } from "@/lib/actions/project";
import ProjectEditForm from "@/components/project/ProjectEditForm";

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

  // 権限チェック (オーナーか管理者のみ編集可能)
  if (project.authorId !== session.user.id && session.user.role !== "admin") {
    redirect(`/projects/${slug}`);
  }

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 800,  mb: 4  }}>
        プロジェクト編集
      </Typography>

      <ProjectEditForm project={project} />
    </Container>
  );
}
