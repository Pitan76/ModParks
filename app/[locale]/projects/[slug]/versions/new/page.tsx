import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import VersionUploadForm from "@/components/project/VersionUploadForm";
import { use } from "react";

interface NewVersionPageProps {
  params: Promise<{ slug: string }>;
}

export default function NewVersionPage({ params }: NewVersionPageProps) {
  const { slug } = use(params);

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Typography variant="h4" sx={{ fontWeight: 800,  mb: 4  }}>
        新バージョンをアップロード
      </Typography>

      <VersionUploadForm slug={slug} />
    </Container>
  );
}
