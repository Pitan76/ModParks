import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getAdminDb } from "@/lib/auth-helpers";
import { getRuntimeConfig } from "@/lib/runtime/state";
import { effectiveMode, normalizeFeatures } from "@/lib/runtime/features";
import FeatureSwitchList from "@/components/admin/FeatureSwitchList";
import RuntimeModePanel from "@/components/admin/RuntimeModePanel";
import SnapshotPanel from "@/components/admin/SnapshotPanel";
import { redirect } from "@/lib/i18n/routing";

interface AdminRuntimePageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminRuntimePage({ params }: AdminRuntimePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  try {
    await getAdminDb();
  } catch {
    redirect({ href: "/", locale: locale });
  }

  const t = await getTranslations("Admin.runtime");
  const config = await getRuntimeConfig();
  const features = normalizeFeatures(config);
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

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{t("modeTitle")}</Typography>
          <RuntimeModePanel
            current={config.mode ?? { mode: "NORMAL" }}
            effective={effectiveMode(config)}
          />
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{t("featuresTitle")}</Typography>
          <FeatureSwitchList initial={features} />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{t("snapshotTitle")}</Typography>
          <SnapshotPanel />
        </CardContent>
      </Card>
    </Box>
  );
}
