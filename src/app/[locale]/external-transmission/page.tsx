import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { setRequestLocale, getTranslations } from "next-intl/server";
import LegalContent from "@/components/ui/LegalContent";
import { canonicalUrl } from "@/lib/seo/canonical";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal" });
  const title = t("externalTransmission.title");
  return {
    title,
    description: `${title} - ModParks`,
    alternates: {
      canonical: canonicalUrl("/external-transmission"),
    },
  };
}

/**
 * 外部送信ポリシー。電気通信事業法27条の12（外部送信規律）に基づく公表用のページ。
 *
 * 「容易に知り得る状態」に置くことが要件なので、フッターから常時1クリックで
 * 到達できるようにし、JS を実行しない相手にも本文が届くようサーバー側で描画する。
 */
export default async function ExternalTransmissionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Legal");

  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: "bold" }}>
        {t("externalTransmission.title")}
      </Typography>
      <Box sx={{ mt: 4 }}>
        <LegalContent content={t("externalTransmission.content")} />
      </Box>
    </Container>
  );
}
