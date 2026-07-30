"use client";

import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import type { AppSettingField, AppSettings } from "@/lib/config/appSettings";

/**
 * アプリ設定のフィールドをメタ情報から描画する。
 * タブごとにフォームの見た目を揃えるため、入力欄の生成はここに集約する。
 */
export default function AppSettingFields({
  fields,
  form,
  onChange,
}: {
  fields: AppSettingField[];
  form: AppSettings;
  onChange: (next: AppSettings) => void;
}) {
  const t = useTranslations("Admin.config");

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {fields.map((field) => {
        if (field.type === "boolean") {
          return (
            <Box key={field.key}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form[field.key] as boolean}
                    onChange={(e) => onChange({ ...form, [field.key]: e.target.checked })}
                  />
                }
                label={t(field.labelKey)}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                {t(field.helpKey)}
              </Typography>
            </Box>
          );
        }

        if (field.type === "string") {
          return (
            <TextField
              key={field.key}
              label={t(field.labelKey)}
              helperText={t(field.helpKey)}
              value={form[field.key] as string}
              onChange={(e) => onChange({ ...form, [field.key]: e.target.value })}
              sx={{ maxWidth: 480 }}
            />
          );
        }

        return (
          <TextField
            key={field.key}
            type="number"
            label={t(field.labelKey)}
            helperText={t(field.helpKey)}
            value={form[field.key] as number}
            onChange={(e) => onChange({ ...form, [field.key]: Number(e.target.value) })}
            sx={{ maxWidth: 320 }}
          />
        );
      })}
    </Box>
  );
}
