import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { setRequestLocale, getTranslations } from "next-intl/server";
import LegalContent from "@/components/ui/LegalContent";
import { seoAlternates } from "@/lib/seo/canonical";

export const generateMetadata = async ({ params }: { params: Promise<{ locale: string }> }) => {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal" });
  const title = t("terms.title");
  return { 
    title,
    description: `${title} - ModParks`,
    alternates: seoAlternates("/terms", locale),
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
        <LegalContent content={t("terms.content")} />
      </Box>
    </Container>
  );
};

export default TermsPage;
