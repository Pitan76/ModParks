"use client";

import { useState, useTransition, useEffect } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import CircularProgress from "@mui/material/CircularProgress";
import ShieldAlertIcon from "@mui/icons-material/Shield";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";
import { useTranslations } from "next-intl";
import { toggleManualUnderAttack } from "@/lib/actions/admin";
import { updateAppSettings } from "@/lib/actions/appSettings";
import type { AppSettings } from "@/lib/config/appSettings";
import type { DdosStateModel } from "@/db/schema";

export default function DdosPanel({
  initialState,
  initialSettings,
}: {
  initialState: DdosStateModel;
  initialSettings: AppSettings;
}) {
  const t = useTranslations("Admin.config");
  const [state, setState] = useState<DdosStateModel>(initialState);
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [durationMin, setDurationMin] = useState<number>(10);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);

  // Remaining time countdown for UNDER_ATTACK or COOLDOWN states
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      if (state.currentState === "UNDER_ATTACK" && state.scheduledDisableAt > now) {
        const diff = state.scheduledDisableAt - now;
        const min = Math.floor(diff / 60000);
        const sec = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${min}m ${sec}s`);
      } else if (state.currentState === "COOLDOWN" && state.cooldownUntil > now) {
        const diff = state.cooldownUntil - now;
        const min = Math.floor(diff / 60000);
        const sec = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${min}m ${sec}s`);
      } else {
        setTimeLeft("");
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [state]);

  const handleToggleUnderAttack = (enable: boolean) => {
    setMessage(null);
    startTransition(async () => {
      const res = await toggleManualUnderAttack(enable, durationMin);
      if ("error" in res) {
        setMessage({ type: "error", text: res.error ?? "Unknown error" });
      } else {
        // Refresh local UI state immediately
        const nextState: DdosStateModel = {
          ...state,
          currentState: enable ? "UNDER_ATTACK" : "NORMAL",
          underAttackEnabledAt: enable ? Date.now() : 0,
          scheduledDisableAt: enable ? Date.now() + durationMin * 60 * 1000 : 0,
        };
        setState(nextState);
        setMessage({
          type: "success",
          text: enable
            ? t("ddosActivatedSuccess", { minutes: durationMin })
            : t("ddosDeactivatedSuccess"),
        });
      }
    });
  };

  const handleSaveSettings = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await updateAppSettings(settings);
      if ("error" in res) {
        setMessage({ type: "error", text: res.error });
      } else {
        setSettings(res.settings);
        setMessage({ type: "success", text: t("appSettingsSaved") });
      }
    });
  };

  // Determine status color and label
  const getStatusDisplay = () => {
    switch (state.currentState) {
      case "UNDER_ATTACK":
        return { color: "error", label: t("ddosStateUnderAttack") };
      case "COOLDOWN":
        return { color: "warning", label: t("ddosStateCooldown") };
      case "ACTIVATING":
      case "DEACTIVATING":
        return { color: "info", label: t("ddosStateTransition") };
      default:
        return { color: "success", label: t("ddosStateNormal") };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {message && (
        <Alert severity={message.type} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {/* --- Section 1: Current Status and Manual Trigger --- */}
      <Card>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
            <Box>
              <Typography variant="h6" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <ShieldAlertIcon color={statusDisplay.color as any} />
                {t("ddosStatus")}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {t("ddosStatusDesc")}
              </Typography>
            </Box>
            <Chip
              icon={<RadioButtonCheckedIcon />}
              label={statusDisplay.label}
              color={statusDisplay.color as any}
              sx={{ fontWeight: "bold", px: 1, py: 2 }}
            />
          </Box>

          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <Card variant="outlined" sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">{t("ddosCurrentState")}</Typography>
                <Typography variant="h6" sx={{ mt: 0.5, fontWeight: "bold" }}>{state.currentState}</Typography>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card variant="outlined" sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  {state.currentState === "UNDER_ATTACK" ? t("ddosActiveRemaining") : t("ddosCooldownRemaining")}
                </Typography>
                <Typography variant="h6" sx={{ mt: 0.5, fontWeight: "bold", color: "primary.main" }}>
                  {timeLeft || "-"}
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card variant="outlined" sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">{t("ddosProtectionDuration")}</Typography>
                <Typography variant="h6" sx={{ mt: 0.5, fontWeight: "bold" }}>
                  {state.protectionDuration / 60000} {t("minutes")}
                </Typography>
              </Card>
            </Grid>
          </Grid>

          <Box sx={{ borderTop: "1px solid", borderColor: "divider", pt: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: "bold", mb: 2 }}>
              {t("ddosManualControl")}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {t("ddosManualControlDesc")}
            </Typography>

            <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
              {state.currentState !== "UNDER_ATTACK" ? (
                <>
                  <TextField
                    type="number"
                    label={t("ddosDurationInput")}
                    value={durationMin}
                    onChange={(e) => setDurationMin(Math.max(1, Number(e.target.value)))}
                    inputProps={{ min: 1, max: 1440 }}
                    size="small"
                    sx={{ width: 150 }}
                  />
                  <Button
                    variant="contained"
                    color="error"
                    disabled={isPending}
                    onClick={() => handleToggleUnderAttack(true)}
                    startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : <ShieldAlertIcon />}
                  >
                    {t("ddosEnableBtn")}
                  </Button>
                </>
              ) : (
                <Button
                  variant="contained"
                  color="success"
                  disabled={isPending}
                  onClick={() => handleToggleUnderAttack(false)}
                  startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : <ShieldAlertIcon />}
                >
                  {t("ddosDisableBtn")}
                </Button>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* --- Section 2: DDoS Threshold Settings --- */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>{t("ddosSettingsTitle")}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            {t("ddosSettingsDesc")}
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 3, maxWidth: 640 }}>
            <TextField
              type="number"
              label={t("ddosThresholdRequests")}
              helperText={t("ddosThresholdRequestsHelp")}
              value={settings.ddosThresholdRequests}
              onChange={(e) => setSettings({ ...settings, ddosThresholdRequests: Number(e.target.value) })}
              fullWidth
            />

            <TextField
              type="number"
              label={t("ddosThresholdDownloadRatio")}
              helperText={t("ddosThresholdDownloadRatioHelp")}
              value={settings.ddosThresholdDownloadRatio}
              onChange={(e) => setSettings({ ...settings, ddosThresholdDownloadRatio: Number(e.target.value) })}
              inputProps={{ step: 0.05, min: 0, max: 1 }}
              fullWidth
            />

            <TextField
              type="number"
              label={t("ddosThresholdTopSlugRatio")}
              helperText={t("ddosThresholdTopSlugRatioHelp")}
              value={settings.ddosThresholdTopSlugRatio}
              onChange={(e) => setSettings({ ...settings, ddosThresholdTopSlugRatio: Number(e.target.value) })}
              inputProps={{ step: 0.05, min: 0, max: 1 }}
              fullWidth
            />

            <TextField
              type="number"
              label={t("ddosThresholdIpRepeatRate")}
              helperText={t("ddosThresholdIpRepeatRateHelp")}
              value={settings.ddosThresholdIpRepeatRate}
              onChange={(e) => setSettings({ ...settings, ddosThresholdIpRepeatRate: Number(e.target.value) })}
              inputProps={{ step: 0.5, min: 1 }}
              fullWidth
            />

            <TextField
              type="number"
              label={t("ddosDefaultProtectionDuration")}
              helperText={t("ddosDefaultProtectionDurationHelp")}
              value={settings.ddosDefaultProtectionDuration}
              onChange={(e) => setSettings({ ...settings, ddosDefaultProtectionDuration: Number(e.target.value) })}
              fullWidth
            />

            <Button
              variant="contained"
              onClick={handleSaveSettings}
              disabled={isPending}
              sx={{ alignSelf: "flex-start", mt: 1 }}
            >
              {t("saveBtn")}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
