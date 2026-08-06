"use client";

import { useState, useTransition } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { TRUST_TIERS, type TrustTier } from "@/db/schema";
import {
  adjustTrustScore,
  recomputeTrustAction,
  setTrustFrozen,
  setTrustTierOverride,
} from "@/lib/actions/adminTrust";

export type TrustActionsPanelProps = {
  userId: string;
  frozen: boolean;
  tierOverride: TrustTier | null;
};

type ActionResult = { success: true } | { error: string };

/**
 * 6.2「変える」。
 * どの操作も理由を必須にし、結果は台帳と監査ログの両方に残る。
 */
export default function TrustActionsPanel({ userId, frozen, tierOverride }: TrustActionsPanelProps) {
  const t = useTranslations("Admin");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [delta, setDelta] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [tier, setTier] = useState<TrustTier | "">(tierOverride ?? "");
  const [overrideReason, setOverrideReason] = useState("");
  const [freezeReason, setFreezeReason] = useState("");

  const run = (action: () => Promise<ActionResult>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if ("error" in result) setError(t(`trust.actions.${result.error}`));
    });
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{t("trust.actions.title")}</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Stack spacing={3}>
        <Box>
          <Typography variant="subtitle2">{t("trust.actions.adjust.title")}</Typography>
          <Typography variant="caption" color="text.secondary">{t("trust.actions.adjust.hint")}</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1 }}>
            <TextField
              size="small" type="number" label={t("trust.actions.adjust.delta")}
              value={delta} onChange={(e) => setDelta(e.target.value)} sx={{ width: 200 }}
            />
            <TextField
              size="small" label={t("trust.actions.reason")} fullWidth
              value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)}
            />
            <Button
              variant="contained" disabled={pending}
              onClick={() => run(() => adjustTrustScore(userId, Number(delta), adjustReason))}
            >
              {t("trust.actions.adjust.submit")}
            </Button>
          </Stack>
        </Box>

        <Box>
          <Typography variant="subtitle2">{t("trust.actions.override.title")}</Typography>
          <Typography variant="caption" color="text.secondary">{t("trust.actions.override.hint")}</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1 }}>
            <TextField
              size="small" select label={t("trust.actions.override.tier")}
              value={tier} onChange={(e) => setTier(e.target.value as TrustTier | "")} sx={{ width: 220 }}
            >
              <MenuItem value="">{t("trust.actions.override.none")}</MenuItem>
              {TRUST_TIERS.map((value) => (
                <MenuItem key={value} value={value}>{t(`trust.filters.${value}`)}</MenuItem>
              ))}
            </TextField>
            <TextField
              size="small" label={t("trust.actions.reason")} fullWidth
              value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)}
            />
            <Button
              variant="outlined" color="warning" disabled={pending}
              onClick={() => run(() => setTrustTierOverride(userId, tier || null, overrideReason))}
            >
              {t("trust.actions.override.submit")}
            </Button>
          </Stack>
        </Box>

        <Box>
          <Typography variant="subtitle2">{t("trust.actions.freeze.title")}</Typography>
          <Typography variant="caption" color="text.secondary">{t("trust.actions.freeze.hint")}</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1 }}>
            <TextField
              size="small" label={t("trust.actions.reason")} fullWidth
              value={freezeReason} onChange={(e) => setFreezeReason(e.target.value)}
            />
            <Button
              variant="outlined" disabled={pending}
              onClick={() => run(() => setTrustFrozen(userId, !frozen, freezeReason))}
            >
              {frozen ? t("trust.actions.freeze.unfreeze") : t("trust.actions.freeze.freeze")}
            </Button>
          </Stack>
        </Box>

        <Box>
          <Typography variant="subtitle2">{t("trust.actions.recompute.title")}</Typography>
          <Typography variant="caption" color="text.secondary">{t("trust.actions.recompute.hint")}</Typography>
          <Box sx={{ mt: 1 }}>
            <Button
              variant="text" disabled={pending}
              onClick={() => run(() => recomputeTrustAction(userId))}
            >
              {t("trust.actions.recompute.submit")}
            </Button>
          </Box>
        </Box>
      </Stack>
    </Paper>
  );
}
