import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getAdminDb } from "@/lib/auth-helpers";
import { getRuntimeConfig } from "@/lib/runtime/state";
import { normalizeFeatures } from "@/lib/runtime/features";
import FeatureSwitchList from "@/components/admin/FeatureSwitchList";

interface AdminRuntimePageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminRuntimePage({ params }: AdminRuntimePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  try {
    await getAdminDb();
  } catch {
    redirect("/");
  }

  const t = await getTranslations("Admin.runtime");
  const features = normalizeFeatures(await getRuntimeConfig());
  const disabled = Object.values(features).filter((state) => !state.enabled).length;

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>{t("title")}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t("description")}
      </Typography>

      {disabled > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>{t("disabledCount", { count: disabled })}</Alert>
      )}

      <Card>
        <CardContent>
          <FeatureSwitchList initial={features} />
        </CardContent>
      </Card>
    </Box>
  );
}
