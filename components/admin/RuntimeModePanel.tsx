"use client";

import { useState, useTransition } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { setRuntimeMode } from "@/lib/actions/runtime";
import { RUNTIME_MODES, type ModeState, type RuntimeMode } from "@/lib/runtime/features";
import { DEFAULT_MODE_HOURS, MODE_DURATION_PRESETS_HOURS } from "@/lib/runtime/mode";

interface RuntimeModePanelProps {
  current: ModeState;
  /** 期限を過ぎて実質 NORMAL になっているか */
  effective: RuntimeMode;
}

function formatUntil(until?: number): string {
  return until ? new Date(until).toISOString().replace("T", " ").slice(0, 16) : "";
}

/**
 * 運用モードの切替。
 *
 * NORMAL 以外にするときは理由と期限を必須にする。
 * 無期限で止められると、戻し忘れたまま気づかれない事故が起きる。
 */
export default function RuntimeModePanel({ current, effective }: RuntimeModePanelProps) {
  const t = useTranslations("Admin.runtime");
  const [mode, setMode] = useState<RuntimeMode>(effective);
  const [reason, setReason] = useState("");
  const [hours, setHours] = useState(DEFAULT_MODE_HOURS);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleApply() {
    setError(null);
    startTransition(async () => {
      const result = await setRuntimeMode(mode, reason, hours);
      if ("error" in result) setError(result.error);
      else setReason("");
    });
  }

  const needsDetail = mode !== "NORMAL";

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">{t("modeHelp")}</Typography>

      {effective !== "NORMAL" && (
        <Alert severity={effective === "MAINTENANCE" ? "error" : "warning"}>
          {t(`modeActive.${effective}`)}
          {current.until && ` — ${t("until", { at: formatUntil(current.until) })}`}
          {current.reason && ` — ${current.reason}`}
        </Alert>
      )}

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      <TextField
        select
        label={t("modeLabel")}
        value={mode}
        onChange={(e) => setMode(e.target.value as RuntimeMode)}
      >
        {RUNTIME_MODES.map((value) => (
          <MenuItem key={value} value={value}>{t(`mode.${value}`)}</MenuItem>
        ))}
      </TextField>

      <Typography variant="caption" color="text.secondary">{t(`modeDesc.${mode}`)}</Typography>

      {needsDetail && (
        <>
          <TextField
            select
            label={t("durationLabel")}
            helperText={t("durationHelp")}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
          >
            {MODE_DURATION_PRESETS_HOURS.map((value) => (
              <MenuItem key={value} value={value}>{t("hours", { count: value })}</MenuItem>
            ))}
          </TextField>

          <TextField
            multiline
            minRows={2}
            label={t("reasonLabel")}
            helperText={t("reasonHelp")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </>
      )}

      <Button
        variant="contained"
        color={mode === "NORMAL" ? "primary" : "error"}
        disabled={isPending || (needsDetail && !reason.trim())}
        onClick={handleApply}
        sx={{ alignSelf: "flex-start" }}
      >
        {t("applyMode")}
      </Button>
    </Stack>
  );
}
