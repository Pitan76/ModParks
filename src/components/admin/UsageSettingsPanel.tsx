"use client";

import { useState, useTransition } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { updateAppSettings } from "@/lib/actions/appSettings";

export type UsageSettingsForm = {
  usagePlan: "free" | "paid";
  usageQuotaRequests: number;
  usageBudgetJpy: number;
};

/** 今日の epoch day。保存時に「確認済み」の印として記録する */
function todayEpochDay(): number {
  return Math.floor(Date.now() / 86_400_000);
}

/**
 * 含有枠と予算の編集。
 *
 * 枠の実値は料金改定で変わるため、コードに直書きせずここから更新する。
 * 保存すると確認日も更新し、古くなったら画面側で再確認を促せるようにする。
 */
export default function UsageSettingsPanel({ initial }: { initial: UsageSettingsForm }) {
  const t = useTranslations("Admin.usage");
  const [form, setForm] = useState(initial);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateAppSettings({ ...form, usageQuotaCheckedDay: todayEpochDay() });
      if ("error" in result) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      setMessage({ type: "success", text: t("saved") });
    });
  }

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">{t("settingsHelp")}</Typography>

      {message && (
        <Alert severity={message.type} onClose={() => setMessage(null)}>{message.text}</Alert>
      )}

      <TextField
        select
        label={t("planLabel")}
        helperText={t("planHelp")}
        value={form.usagePlan}
        onChange={(e) => setForm({ ...form, usagePlan: e.target.value as "free" | "paid" })}
      >
        <MenuItem value="free">{t("plan.free")}</MenuItem>
        <MenuItem value="paid">{t("plan.paid")}</MenuItem>
      </TextField>

      <TextField
        type="number"
        label={t("quotaRequestsLabel")}
        helperText={t(`quotaRequestsHelp.${form.usagePlan}`)}
        value={form.usageQuotaRequests}
        onChange={(e) => setForm({ ...form, usageQuotaRequests: Number(e.target.value) })}
      />

      {form.usagePlan === "paid" && (
        <TextField
          type="number"
          label={t("budgetLabel")}
          helperText={t("budgetHelp")}
          value={form.usageBudgetJpy}
          onChange={(e) => setForm({ ...form, usageBudgetJpy: Number(e.target.value) })}
        />
      )}

      <Button variant="contained" onClick={handleSave} disabled={isPending} sx={{ alignSelf: "flex-start" }}>
        {t("save")}
      </Button>
    </Stack>
  );
}
