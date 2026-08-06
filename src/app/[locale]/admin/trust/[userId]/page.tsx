import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { notFound, redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getAdminDb } from "@/lib/auth-helpers";
import { getTrustDetail } from "@/lib/queries/adminTrust";
import { tierFromScore } from "@/lib/trust/score";
import TrustEventTable from "@/components/admin/TrustEventTable";
import TrustActionsPanel from "@/components/admin/TrustActionsPanel";
import { TIER_COLORS } from "@/components/admin/trustTierColors";

interface AdminTrustDetailPageProps {
  params: Promise<{ locale: string; userId: string }>;
}

export default async function AdminTrustDetailPage({ params }: AdminTrustDetailPageProps) {
  const { locale, userId } = await params;
  setRequestLocale(locale);

  try {
    await getAdminDb();
  } catch {
    redirect("/");
  }

  const t = await getTranslations("Admin");
  const detail = await getTrustDetail(userId);
  if (!detail) notFound();

  const derived = tierFromScore(detail.score);

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>{t("trust.detail.title")}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {detail.username ?? detail.email ?? detail.userId}
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
          <Box>
            <Typography variant="caption" color="text.secondary">{t("trust.detail.score")}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {detail.score}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">{t("trust.detail.tier")}</Typography>
            <Box sx={{ mt: 0.5 }}>
              <Chip label={t(`trust.filters.${detail.tier}`)} color={TIER_COLORS[detail.tier]} />
            </Box>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              {detail.toNextTier === null
                ? t("trust.detail.maxTier")
                : t("trust.detail.toNextTier", { points: detail.toNextTier })}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* 上書き中は、スコアからの導出値と食い違っていることを必ず見せる */}
      {detail.tierOverride && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t("trust.detail.overrideNotice", { derived: t(`trust.filters.${derived}`) })}
          {detail.tierOverrideUntil && (
            <> {t("trust.detail.overrideUntil", { date: detail.tierOverrideUntil.toLocaleString(locale) })}</>
          )}
        </Alert>
      )}

      {detail.frozen && (
        <Alert severity="info" sx={{ mb: 2 }}>{t("trust.detail.frozenNotice")}</Alert>
      )}

      <TrustActionsPanel
        userId={detail.userId}
        frozen={detail.frozen}
        tierOverride={detail.tierOverride}
      />

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" sx={{ fontWeight: 700 }}>{t("trust.detail.ledger")}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("trust.detail.ledgerHint")}
      </Typography>

      <TrustEventTable events={detail.events} locale={locale} userId={detail.userId} />
    </Box>
  );
}
