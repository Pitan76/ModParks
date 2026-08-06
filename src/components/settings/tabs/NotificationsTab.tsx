"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import { updateNotificationPrefs } from "@/lib/actions/notification";
import { NOTIFICATION_TYPES, normalizePrefs } from "@/lib/notifications/types";
import { useFlashMessage } from "@/lib/hooks/useFlashMessage";
import { useDirtyForm } from "@/lib/hooks/useDirtyForm";
import StickySaveBar from "@/components/ui/StickySaveBar";
import { isPushSupported, getPushSubscription, enablePush, disablePush } from "@/lib/push-client";
import TextField from "@mui/material/TextField";

interface Props {
  initialPrefs: Record<string, boolean> | null;
  initialWebhookUrl?: string | null;
}

export default function NotificationsTab({ initialPrefs, initialWebhookUrl }: Props) {
  const t = useTranslations("Settings");
  const tn = useTranslations("Notifications");
  const { message, flash } = useFlashMessage();
  const [webhookError, setWebhookError] = useState<string | null>(null);

  const form = useDirtyForm({
    prefs: normalizePrefs(initialPrefs),
    discordWebhookUrl: initialWebhookUrl || "",
  }, async (values) => {
    setWebhookError(null);
    const res = await updateNotificationPrefs(values.prefs, values.discordWebhookUrl);
    if (res && res.success === false && res.error === "invalid_webhook") {
      setWebhookError(t("notifications.webhookError"));
      return;
    }
    flash("success", t("notifications.successUpdate"));
  });
  const prefs = form.values.prefs;

  const handleWebhookChange = (val: string) => {
    setWebhookError(null);
    form.setField("discordWebhookUrl", val);
  };

  // ---- Web Push（PWA プッシュ通知）の端末単位トグル ----
  const [pushSupported, setPushSupported] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) return;
    setPushSupported(true);
    getPushSubscription().then((sub) => setPushOn(!!sub));
  }, []);

  const togglePush = async () => {
    setPushBusy(true);
    try {
      if (pushOn) {
        await disablePush();
        setPushOn(false);
        flash("success", t("notifications.pushDisabled"));
      } else {
        const res = await enablePush();
        if (res.ok) {
          setPushOn(true);
          flash("success", t("notifications.pushEnabled"));
        } else if (res.reason === "denied") {
          flash("error", t("notifications.pushDenied"));
        } else {
          flash("error", t("notifications.pushError"));
        }
      }
    } finally {
      setPushBusy(false);
    }
  };

  const toggle = (type: string) =>
    form.setField("prefs", (prev) => ({
      ...prev,
      [type]: !(prev as any)[type],
    }));

  return (
    <Box sx={{ p: "2px" }}>
      {message && <Alert severity={message.type} sx={{ mb: 3 }}>{message.text}</Alert>}

      {/* プッシュ通知（端末単位） */}
      <Typography variant="h6" sx={{ mb: 1 }}>{t("notifications.pushTitle")}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("notifications.pushDescription")}
      </Typography>
      {pushSupported ? (
        <FormControlLabel
          control={<Switch checked={pushOn} disabled={pushBusy} onChange={togglePush} />}
          label={t("notifications.pushToggle")}
        />
      ) : (
        <Alert severity="info" sx={{ mb: 2 }}>{t("notifications.pushUnsupported")}</Alert>
      )}

      <Divider sx={{ my: 3 }} />

      {/* 通知種別ごとの受信可否 */}
      <Typography variant="h6" sx={{ mb: 2 }}>{t("notifications.title")}</Typography>

      <FormGroup sx={{ mb: 4 }}>
        {NOTIFICATION_TYPES.map((type) => (
          <FormControlLabel
            key={type}
            control={<Switch checked={prefs[type]} onChange={() => toggle(type)} />}
            label={tn(`type.${type}`)}
          />
        ))}
      </FormGroup>

      <Divider sx={{ my: 3 }} />

      {/* Webhook通知設定 */}
      <Typography variant="h6" sx={{ mb: 1 }}>{t("notifications.webhookTitle")}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("notifications.webhookDescription")}
      </Typography>
      <TextField
        fullWidth
        name="discordWebhookUrl"
        label={t("notifications.webhookUrlLabel")}
        placeholder="https://discord.com/api/webhooks/..."
        value={form.values.discordWebhookUrl}
        onChange={(e) => handleWebhookChange(e.target.value)}
        error={!!webhookError}
        helperText={webhookError || t("notifications.webhookHelp")}
        sx={{ mb: 4 }}
      />

      <StickySaveBar
        open={form.dirty}
        saving={form.saving}
        onSave={form.submit}
        onDiscard={() => {
          setWebhookError(null);
          form.reset();
        }}
      />
    </Box>
  );
}
