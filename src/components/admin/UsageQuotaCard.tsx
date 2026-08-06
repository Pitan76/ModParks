import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import type { QuotaUsage, UsageLevel } from "@/lib/usage/quota";

/** 深刻度に対応する MUI の色 */
const LEVEL_COLOR: Record<UsageLevel, "success" | "info" | "warning" | "error"> = {
  normal: "success",
  notice: "info",
  warning: "warning",
  critical: "error",
};

interface UsageQuotaCardProps {
  labelKey: string;
  usage: QuotaUsage;
  /** 期間の経過割合。想定ペースの目安として併記する */
  progress: number;
}

/**
 * 含有枠に対する消費率のゲージ。
 *
 * 枠が未設定（0）のときは実数だけを出し、割合を出さない。
 * 根拠のない割合を出すと判断を誤らせるため。
 */
export default function UsageQuotaCard({ labelKey, usage, progress }: UsageQuotaCardProps) {
  const t = useTranslations("Admin.usage");
  const hasQuota = usage.ratio !== null;
  const percent = hasQuota ? Math.min(usage.ratio! * 100, 100) : 0;

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline", mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{t(labelKey)}</Typography>
        <Typography variant="body2" color="text.secondary">
          {hasQuota
            ? t("ofQuota", { used: usage.used.toLocaleString(), quota: usage.quota.toLocaleString() })
            : usage.used.toLocaleString()}
        </Typography>
      </Stack>

      {hasQuota ? (
        <>
          <LinearProgress
            variant="determinate"
            value={percent}
            color={LEVEL_COLOR[usage.level]}
            sx={{ height: 8, borderRadius: 1 }}
          />
          <Stack direction="row" sx={{ justifyContent: "space-between", mt: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              {t("consumed", { percent: (usage.ratio! * 100).toFixed(1) })}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t("expectedPace", { percent: (progress * 100).toFixed(1) })}
            </Typography>
          </Stack>
        </>
      ) : (
        <Typography variant="caption" color="text.secondary">{t("quotaUnset")}</Typography>
      )}
    </Box>
  );
}
