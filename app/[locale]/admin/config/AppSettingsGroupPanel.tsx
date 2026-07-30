"use client";

import { useState, useTransition } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { updateAppSettings } from "@/lib/actions/appSettings";
import { getAppSettingFields, type AppSettingGroup, type AppSettings } from "@/lib/config/appSettings";
import AppSettingFields from "./AppSettingFields";

/**
 * アプリ設定の 1 グループ分を編集するパネル。
 * 保存は設定全体を書き戻すため、タブが増えても保存処理は共通のままにする。
 */
export default function AppSettingsGroupPanel({
  initialSettings,
  group,
  titleKey,
  descKey,
}: {
  initialSettings: AppSettings;
  group: AppSettingGroup;
  titleKey: string;
  descKey: string;
}) {
  const t = useTranslations("Admin.config");
  const [form, setForm] = useState<AppSettings>(initialSettings);
  const [message, setMessage] = useState<{
    type: "success" | "error" | "warning";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateAppSettings(form);
      if ("error" in result) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      // KV は結果整合性のため、保存直後は書き込んだ値をそのまま表示する
      setForm(result.settings);
      setMessage(
        result.warning
          ? { type: "warning", text: `${t("appSettingsSaved")} — ${result.warning}` }
          : { type: "success", text: t("appSettingsSaved") }
      );
    });
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 1 }}>{t(titleKey)}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t(descKey)}
        </Typography>

        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}

        <AppSettingFields fields={getAppSettingFields(group)} form={form} onChange={setForm} />

        <Button variant="contained" onClick={handleSave} disabled={isPending} sx={{ mt: 3 }}>
          {t("saveBtn")}
        </Button>
      </CardContent>
    </Card>
  );
}
