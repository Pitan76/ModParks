"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import { updateNotificationPrefs } from "@/lib/actions/notification";
import { NOTIFICATION_TYPES, normalizePrefs } from "@/lib/notifications/types";
import { useFlashMessage } from "@/lib/hooks/useFlashMessage";

interface Props {
  initialPrefs: Record<string, boolean> | null;
}

export default function NotificationsTab({ initialPrefs }: Props) {
  const t = useTranslations("Settings");
  const tn = useTranslations("Notifications");
  const { message, flash } = useFlashMessage();
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => normalizePrefs(initialPrefs));

  const toggle = (type: string) => setPrefs((prev) => ({ ...prev, [type]: !prev[type] }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateNotificationPrefs(prefs);
    flash("success", t("notifications.successUpdate"));
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      {message && <Alert severity={message.type} sx={{ mb: 3 }}>{message.text}</Alert>}

      <Typography variant="h6" sx={{ mb: 1 }}>{t("notifications.title")}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t("notifications.description")}</Typography>

      <FormGroup sx={{ mb: 4 }}>
        {NOTIFICATION_TYPES.map((type) => (
          <FormControlLabel
            key={type}
            control={<Switch checked={prefs[type]} onChange={() => toggle(type)} />}
            label={tn(`type.${type}`)}
          />
        ))}
      </FormGroup>

      <Button type="submit" variant="contained" sx={{ display: "block" }}>{t("profile.save")}</Button>
    </Box>
  );
}
