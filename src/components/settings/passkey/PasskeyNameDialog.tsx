"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import AbstractDialog from "@/components/ui/AbstractDialog";
import FormTextField from "@/components/ui/form/FormTextField";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
}

/**
 * パスキー登録時に表示名（端末名など）を入力させるダイアログ。
 */
export default function PasskeyNameDialog({ open, onClose, onConfirm }: Props) {
  const t = useTranslations("Settings");
  const tCommon = useTranslations("Common");
  const [name, setName] = useState("");

  const handleConfirm = () => {
    onConfirm(name);
    setName("");
  };

  return (
    <AbstractDialog
      open={open}
      onClose={onClose}
      title={t("security.passkeyNameTitle")}
      onCancel={onClose}
      onConfirm={handleConfirm}
      confirmText={tCommon("save")}
      cancelText={tCommon("cancel")}
    >
      <FormTextField
        fullWidth
        autoFocus
        size="small"
        label={t("security.passkeyName")}
        placeholder={t("security.passkeyNamePlaceholder")}
        value={name}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
      />
    </AbstractDialog>
  );
}
