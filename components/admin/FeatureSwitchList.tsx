"use client";

import { useState, useTransition } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { setFeatureEnabled } from "@/lib/actions/runtime";
import { RUNTIME_FEATURES, type FeatureState, type RuntimeFeature } from "@/lib/runtime/features";

interface FeatureSwitchListProps {
  initial: Record<RuntimeFeature, FeatureState>;
}

/** 停止時刻の表示。未設定なら空文字 */
function formatDisabledAt(at?: number): string {
  return at ? new Date(at).toISOString().replace("T", " ").slice(0, 16) : "";
}

/**
 * 機能スイッチの一覧。
 *
 * 停止は理由の入力を必須にするためダイアログを挟む。
 * 再開はワンクリックでよい（戻す操作を重くすると復旧が遅れる）。
 */
export default function FeatureSwitchList({ initial }: FeatureSwitchListProps) {
  const t = useTranslations("Admin.runtime");
  const [states, setStates] = useState(initial);
  const [target, setTarget] = useState<RuntimeFeature | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function apply(feature: RuntimeFeature, enabled: boolean, why: string) {
    setError(null);
    startTransition(async () => {
      const result = await setFeatureEnabled(feature, enabled, why);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setStates((prev) => ({
        ...prev,
        [feature]: result.config.features[feature] ?? { enabled: true },
      }));
      setTarget(null);
      setReason("");
    });
  }

  function handleToggle(feature: RuntimeFeature, next: boolean) {
    if (next) return apply(feature, true, "");
    setTarget(feature);
    setReason("");
  }

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {RUNTIME_FEATURES.map((feature) => {
        const state = states[feature];
        return (
          <Stack
            key={feature}
            direction="row"
            spacing={2}
            sx={{ alignItems: "flex-start", justifyContent: "space-between" }}
          >
            <div>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {t(`feature.${feature}`)}
                </Typography>
                {/* スイッチの向きだけでは有効・停止が読み取りにくいため状態を文字で出す */}
                <Chip
                  size="small"
                  color={state.enabled ? "success" : "error"}
                  variant={state.enabled ? "outlined" : "filled"}
                  label={t(state.enabled ? "statusEnabled" : "statusDisabled")}
                />
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                {t(`featureHelp.${feature}`)}
              </Typography>
              {!state.enabled && (
                <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
                  {t("disabledSince", { at: formatDisabledAt(state.disabledAt) })} — {state.reason}
                </Typography>
              )}
            </div>
            <Switch
              checked={state.enabled}
              disabled={isPending}
              onChange={(e) => handleToggle(feature, e.target.checked)}
            />
          </Stack>
        );
      })}

      <Dialog open={target !== null} onClose={() => setTarget(null)} fullWidth maxWidth="sm">
        <DialogTitle>{t("disableTitle")}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t("reasonHelp")}
          </Typography>
          <TextField
            fullWidth
            autoFocus
            multiline
            minRows={2}
            label={t("reasonLabel")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTarget(null)}>{t("cancel")}</Button>
          <Button
            variant="contained"
            color="error"
            disabled={isPending || !reason.trim()}
            onClick={() => target && apply(target, false, reason)}
          >
            {t("disable")}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
