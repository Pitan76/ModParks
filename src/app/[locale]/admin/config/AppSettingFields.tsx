"use client";

import { Fragment } from "react";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import type { AppSettingField, AppSettings } from "@/lib/config/appSettings";

/**
 * 見出しで区切る小分類。タブ内の項目数が多いので、関連するものだけを塊にして読ませる。
 * ここに載っていないキーは直前の見出しの続きとして扱う。
 */
const SECTION_HEADINGS: Partial<Record<AppSettingField["key"], string>> = {
  apiDefaultLimit: "sectionApi",
  registrationEnabled: "sectionRegistration",
  autoBackupEnabled: "sectionBackup",
  mailFromAddress: "sectionMail",
  creatorRewardEnabled: "sectionReward",
  rewardWeightView: "sectionRewardScore",
  payoutMinPoints: "sectionPayout",
};

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
      {fields.map((field, index) => {
        const headingKey = SECTION_HEADINGS[field.key];
        const heading = headingKey ? (
          <Box key={`${field.key}-heading`} sx={{ mt: index === 0 ? 0 : 2 }}>
            {index > 0 && <Divider sx={{ mb: 2 }} />}
            <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
              {t(headingKey)}
            </Typography>
          </Box>
        ) : null;

        const control = field.type === "boolean" ? (
          <Box>
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
        ) : field.type === "string" ? (
          <TextField
            label={t(field.labelKey)}
            helperText={t(field.helpKey)}
            value={form[field.key] as string}
            onChange={(e) => onChange({ ...form, [field.key]: e.target.value })}
            sx={{ maxWidth: 480 }}
          />
        ) : (
          <TextField
            type="number"
            label={t(field.labelKey)}
            helperText={t(field.helpKey)}
            value={form[field.key] as number}
            onChange={(e) => onChange({ ...form, [field.key]: Number(e.target.value) })}
            sx={{ maxWidth: 320 }}
          />
        );

        return (
          <Fragment key={field.key}>
            {heading}
            {control}
          </Fragment>
        );
      })}
    </Box>
  );
}
