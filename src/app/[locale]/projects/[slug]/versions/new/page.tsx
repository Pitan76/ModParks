import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";
import { getDb, getD1 } from "@/lib/db";
import { auth } from "@/lib/auth";
import VersionUploadForm from "@/components/project/VersionUploadForm";
import { getTranslations } from "next-intl/server";
import { getPreviousVersionSettings } from "@/lib/queries/previousVersionSettings";
import { findProjectPostBySlug } from "@/lib/queries/post";
import { loadVersionUploadContext } from "@/lib/queries/versionUploadContext";

interface NewVersionPageProps {
  params: Promise<{ slug: string }>;
}

export default async function NewVersionPage({ params }: NewVersionPageProps) {
  const { slug } = await params;
  const t = await getTranslations("Project");

  const d1 = await getD1();
  const db = getDb(d1);

  const [project, session] = await Promise.all([
    findProjectPostBySlug(db, slug),
    auth(),
  ]);
  if (!project) notFound();

  const [uploadContext, previousSettings] = await Promise.all([
    loadVersionUploadContext(db, project, session?.user?.id),
    getPreviousVersionSettings(slug),
  ]);

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Typography variant="h4" sx={{ fontWeight: 800,  mb: 4  }}>
        {t("uploadNewVersion")}
      </Typography>

      <VersionUploadForm {...uploadContext} previousSettings={previousSettings} />
    </Container>
  );
}
