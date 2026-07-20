import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { setRequestLocale, getTranslations } from "next-intl/server";
import MarkdownRenderer from "@/components/ui/MarkdownRenderer";
import { SITE_URL } from "@/lib/config";

export const generateMetadata = async ({ params }: { params: Promise<{ locale: string }> }) => {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal" });
  const title = t("terms.title");
  return { 
    title,
    description: `${title} - ModParks`,
    alternates: {
      canonical: `${SITE_URL}/${locale}/terms`,
      languages: {
        ja: `${SITE_URL}/ja/terms`,
        en: `${SITE_URL}/en/terms`,
      },
    },
  };
};

const TermsPage = async ({ params }: { params: Promise<{ locale: string }> }) => {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Legal");

  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: "bold" }}>
        {t("terms.title")}
      </Typography>
      <Box sx={{ mt: 4 }}>
        <MarkdownRenderer content={t("terms.content")} />
      </Box>
    </Container>
  );
};

export default TermsPage;
