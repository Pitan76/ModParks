import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { setRequestLocale, getTranslations } from "next-intl/server";
import MarkdownRenderer from "@/components/ui/MarkdownRenderer";
import { SITE_URL } from "@/lib/config";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal" });
  const title = t("privacy.title");
  return { 
    title,
    description: `${title} - ModParks`,
    alternates: {
      canonical: `${SITE_URL}/${locale}/privacy`,
      languages: {
        ja: `${SITE_URL}/ja/privacy`,
        en: `${SITE_URL}/en/privacy`,
      },
    },
  };
}

export default async function PrivacyPolicyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Legal");

  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: "bold" }}>
        {t("privacy.title")}
      </Typography>
      <Box sx={{ mt: 4 }}>
        <MarkdownRenderer content={t("privacy.content")} />
      </Box>
    </Container>
  );
}
