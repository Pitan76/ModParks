import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { getDb, getD1 } from "@/lib/db";
import { ideas, platforms as platformsTable } from "@/db/schema";
import { inArray } from "drizzle-orm";
import VersionUploadForm from "@/components/project/VersionUploadForm";
import { getTranslations } from "next-intl/server";

interface NewVersionPageProps {
  params: Promise<{ slug: string }>;
}

export default async function NewVersionPage({ params }: NewVersionPageProps) {
  const { slug } = await params;
  const t = await getTranslations("Project");

  const d1 = await getD1();
  const db = getDb(d1);
  const openIdeas = await db
    .select({ id: ideas.id, title: ideas.title })
    .from(ideas)
    .where(inArray(ideas.status, ["open", "in_progress"]))
    .all();

  const availablePlatforms = await db.select({ slug: platformsTable.slug, name: platformsTable.name }).from(platformsTable).all();

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Typography variant="h4" sx={{ fontWeight: 800,  mb: 4  }}>
        {t("uploadNewVersion")}
      </Typography>

      <VersionUploadForm slug={slug} openIdeas={openIdeas} availablePlatforms={availablePlatforms} />
    </Container>
  );
}
