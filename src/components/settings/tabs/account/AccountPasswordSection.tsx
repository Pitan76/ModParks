"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import FormTextField from "@/components/ui/form/FormTextField";
import { changePassword } from "@/lib/actions/settingsSecurity";
import { useTranslations } from "next-intl";

export type AccountPasswordSectionProps = {
  /** 既にパスワードを設定済みか。未設定（OAuth のみ）なら現在のパスワードを問わない */
  hasPassword: boolean;
  is2FAEnabled: boolean;
  /** `account.*` 配下の翻訳キーで結果を通知する */
  onResult: (type: "success" | "error", key: string) => void;
};

/**
 * パスワードの変更（未設定なら新規設定）フォーム。
 * 保存バーとは独立した自前の submit を持つため、1 つの節として切り出している。
 */
export default function AccountPasswordSection({ hasPassword, is2FAEnabled, onResult }: AccountPasswordSectionProps) {
  const t = useTranslations("Settings");

  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [totpToken, setTotpToken] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== confirmPass) {
      onResult("error", "passwordMismatch");
      return;
    }
    const res = await changePassword(oldPass, newPass, totpToken);
    if (res.error) {
      onResult("error", res.error);
      return;
    }
    onResult("success", hasPassword ? "successPassword" : "successSetPassword");
    setOldPass("");
    setNewPass("");
    setConfirmPass("");
    setTotpToken("");
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mb: 4, p: "2px" }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {hasPassword ? t("account.changePassword") : t("account.setPassword")}
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2, maxWidth: 300 }}>
        {hasPassword && (
          <FormTextField
            label={t("account.currentPassword")}
            type="password"
            size="small"
            value={oldPass}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOldPass(e.target.value)}
            required
          />
        )}
        <FormTextField
          label={t("account.newPassword")}
          type="password"
          size="small"
          value={newPass}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPass(e.target.value)}
          required
        />
        <FormTextField
          label={t("account.confirmPassword")}
          type="password"
          size="small"
          value={confirmPass}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPass(e.target.value)}
          required
        />
        {is2FAEnabled && (
          <FormTextField
            label={t("security.verificationCode")}
            type="text"
            size="small"
            value={totpToken}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTotpToken(e.target.value)}
            required
          />
        )}
        <Button type="submit" variant="contained" sx={{ alignSelf: "flex-start", height: 40 }}>
          {hasPassword ? t("account.updateBtn") : t("account.setBtn")}
        </Button>
      </Box>
    </Box>
  );
}
