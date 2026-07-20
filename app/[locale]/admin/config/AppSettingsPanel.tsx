"use client";

import { useState, useTransition } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { updateAppSettings } from "@/lib/actions/appSettings";
import { APP_SETTING_FIELDS, type AppSettings } from "@/lib/config/appSettings";

export default function AppSettingsPanel({ initialSettings }: { initialSettings: AppSettings }) {
  const t = useTranslations("Admin.config");
  const [form, setForm] = useState<AppSettings>(initialSettings);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await updateAppSettings(form);
      if ("error" in result) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      // KV は結果整合性のため、保存直後は書き込んだ値をそのまま表示する
      setForm(result.settings);
      setMessage({ type: "success", text: t("appSettingsSaved") });
    });
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 1 }}>{t("appSettings")}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t("appSettingsDesc")}
        </Typography>

        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}

        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {APP_SETTING_FIELDS.map((field) =>
            field.type === "boolean" ? (
              <Box key={field.key}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form[field.key] as boolean}
                      onChange={(e) => setForm({ ...form, [field.key]: e.target.checked })}
                    />
                  }
                  label={t(field.labelKey)}
                />
                <Typography variant="caption" color="text.secondary" display="block">
                  {t(field.helpKey)}
                </Typography>
              </Box>
            ) : (
              <TextField
                key={field.key}
                type="number"
                label={t(field.labelKey)}
                helperText={t(field.helpKey)}
                value={form[field.key] as number}
                onChange={(e) => setForm({ ...form, [field.key]: Number(e.target.value) })}
                sx={{ maxWidth: 320 }}
              />
            )
          )}
        </Box>

        <Button variant="contained" onClick={handleSave} disabled={isPending} sx={{ mt: 3 }}>
          {t("saveBtn")}
        </Button>
      </CardContent>
    </Card>
  );
}
