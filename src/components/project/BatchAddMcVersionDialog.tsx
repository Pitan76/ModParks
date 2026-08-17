"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import AbstractDialog from "@/components/ui/AbstractDialog";
import McVersionAutocomplete from "./McVersionAutocomplete";
import { useTranslations } from "next-intl";

export type BatchAddMcVersionDialogProps = {
  open: boolean;
  onClose: () => void;
  selectedCount: number;
  modrinthAvailable: boolean;
  curseforgeAvailable: boolean;
  pending: boolean;
  onSubmit: (mcVersions: string[], syncModrinth: boolean, syncCurseforge: boolean) => Promise<boolean>;
};

/**
 * 選択中の複数バージョンへ、対応MCバージョンをまとめて追加するダイアログ。
 * CurseForge には既存ファイルの対応バージョンを事後追加する公式APIが無いため対象外。
 */
export default function BatchAddMcVersionDialog({
  open,
  onClose,
  selectedCount,
  modrinthAvailable,
  curseforgeAvailable,
  pending,
  onSubmit,
}: BatchAddMcVersionDialogProps) {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Version");

  const [mcVersions, setMcVersions] = useState<string[]>([]);
  const [syncModrinth, setSyncModrinth] = useState(false);
  const [syncCurseforge, setSyncCurseforge] = useState(false);

  const handleClose = () => {
    if (pending) return;
    setMcVersions([]);
    setSyncModrinth(false);
    setSyncCurseforge(false);
    onClose();
  };

  const handleConfirm = async () => {
    if (mcVersions.length === 0) return;
    const ok = await onSubmit(mcVersions, syncModrinth && modrinthAvailable, syncCurseforge && curseforgeAvailable);
    if (ok) {
      setMcVersions([]);
      setSyncModrinth(false);
      setSyncCurseforge(false);
    }
  };

  return (
    <AbstractDialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      title={t("manager.batch.dialogTitle")}
      onCancel={handleClose}
      onConfirm={handleConfirm}
      cancelText={tCommon("cancel")}
      confirmText={t("manager.batch.apply")}
      isSubmitting={pending}
      confirmDisabled={mcVersions.length === 0}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {t("manager.batch.dialogDescription", { count: selectedCount })}
        </Typography>

        <McVersionAutocomplete
          value={mcVersions}
          onChange={setMcVersions}
          label={t("manager.batch.mcVersionLabel")}
          required
        />

        <Box>
          <FormControlLabel
            control={
              <Checkbox
                checked={syncModrinth && modrinthAvailable}
                disabled={!modrinthAvailable}
                onChange={(e) => setSyncModrinth(e.target.checked)}
              />
            }
            label={t("manager.batch.syncModrinth")}
          />
          <Typography variant="caption" color="text.secondary" component="p">
            {modrinthAvailable ? t("manager.batch.syncModrinthHint") : t("manager.batch.syncModrinthUnavailable")}
          </Typography>
        </Box>

        <Box>
          <FormControlLabel
            control={
              <Checkbox
                checked={syncCurseforge && curseforgeAvailable}
                disabled={!curseforgeAvailable}
                onChange={(e) => setSyncCurseforge(e.target.checked)}
              />
            }
            label={t("manager.batch.syncCurseforge")}
          />
          <Typography variant="caption" color="text.secondary" component="p">
            {curseforgeAvailable ? t("manager.batch.syncCurseforgeHint") : t("manager.batch.syncCurseforgeUnavailable")}
          </Typography>
        </Box>
      </Box>
    </AbstractDialog>
  );
}
