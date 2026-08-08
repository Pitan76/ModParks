"use client";

import { useTranslations } from "next-intl";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useRecipeLimits } from "./useRecipeLimits";

/** 無制限を表す値。レシピCDN側と同じ約束。 */
const UNLIMITED = -1;

/**
 * 投稿上限の管理。
 *
 * 日次枠と namespace 所有はどちらも投稿を止めますが、投稿者から見た意味も対処も違います。
 * 両方を並べて出し、その場で緩められるようにします。
 */
export default function LimitsPanel() {
  const t = useTranslations("Admin.recipe.limits");
  const s = useRecipeLimits();
  const shown = (n: number): string => (n === UNLIMITED ? t("unlimited") : String(n));

  return (
    <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        {t("title")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("desc")}
      </Typography>

      {s.error && <Alert severity="error" sx={{ mb: 2 }}>{s.error}</Alert>}

      <Stack spacing={3}>
        <Box sx={{ display: "flex", gap: 2 }}>
          <TextField
            size="small"
            label={t("searchPlaceholder")}
            value={s.query}
            onChange={(e) => s.setQuery(e.target.value)}
            disabled={s.loading}
            sx={{ flexGrow: 1 }}
          />
          <Button variant="contained" onClick={s.search} disabled={s.loading}>
            {t("search")}
          </Button>
        </Box>

        {s.identities && <IdentityList identities={s.identities} state={s} />}

        {s.limits && (
          <>
            <Divider />
            <LimitsDetail state={s} shown={shown} />
          </>
        )}
      </Stack>
    </Paper>
  );
}

/** 検索で当たった投稿者の一覧。 */
function IdentityList({
  identities,
  state,
}: {
  identities: { id: string; display_name: string; owned: number }[];
  state: ReturnType<typeof useRecipeLimits>;
}) {
  const t = useTranslations("Admin.recipe.limits");
  if (identities.length === 0) return <Typography variant="body2">{t("noIdentities")}</Typography>;

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {identities.map((i) => (
        <Chip
          key={i.id}
          label={`${i.display_name} (${i.owned})`}
          onClick={() => state.select(i.id)}
          color={state.limits?.identityId === i.id ? "primary" : "default"}
          variant={state.limits?.identityId === i.id ? "filled" : "outlined"}
          disabled={state.loading}
        />
      ))}
    </Stack>
  );
}

/** 選択中の投稿者の使用状況と、上限の変更。 */
function LimitsDetail({
  state,
  shown,
}: {
  state: ReturnType<typeof useRecipeLimits>;
  shown: (n: number) => string;
}) {
  const t = useTranslations("Admin.recipe.limits");
  const limits = state.limits!;

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {t("daily")}: {limits.used} / {shown(limits.limits.dailyLimit)} ({limits.day})
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t("namespaces")}: {limits.namespaces.length} / {shown(limits.limits.nsLimit)}
      </Typography>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {limits.namespaces.map((n) => (
          <Chip key={n.ns} size="small" variant="outlined" label={`${n.ns} (${n.trust})`} />
        ))}
      </Stack>

      <Typography variant="caption" color="text.secondary">
        {t("hint")}
      </Typography>

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <TextField
          size="small"
          label={t("nsLimit")}
          value={state.nsLimit}
          onChange={(e) => state.setNsLimit(e.target.value)}
          disabled={state.loading}
        />
        <TextField
          size="small"
          label={t("dailyLimit")}
          value={state.dailyLimit}
          onChange={(e) => state.setDailyLimit(e.target.value)}
          disabled={state.loading}
        />
        <Button
          variant="contained"
          onClick={state.applyLimits}
          disabled={state.loading || (!state.nsLimit && !state.dailyLimit)}
        >
          {t("apply")}
        </Button>
      </Box>

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
        <Button variant="outlined" onClick={state.resetQuota} disabled={state.loading}>
          {t("resetQuota")}
        </Button>
        <TextField
          size="small"
          label={t("releasePlaceholder")}
          value={state.releaseNamespace}
          onChange={(e) => state.setReleaseNamespace(e.target.value)}
          disabled={state.loading}
        />
        {/* 解除した namespace は次に投稿した人が先着で取るため、取り消しが効きません。 */}
        <Button
          variant="outlined"
          color="warning"
          onClick={state.release}
          disabled={state.loading || !state.releaseNamespace}
        >
          {t("release")}
        </Button>
      </Box>
    </Stack>
  );
}
