"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import Checkbox from "@mui/material/Checkbox";
import FormGroup from "@mui/material/FormGroup";
import AbstractDialog from "@/components/ui/AbstractDialog";
import McVersionAutocomplete from "./McVersionAutocomplete";
import { useTranslations } from "next-intl";

export type BatchProjectMcVersionDialogProps = {
  open: boolean;
  onClose: () => void;
  selectedCount: number;
  pending: boolean;
  onSubmit: (
    operation: "add" | "remove" | "set",
    mcVersions: string[],
    targetVersions: "all" | "latest",
    platforms: { modparks: boolean; modrinth: boolean }
  ) => Promise<boolean>;
};

export default function BatchProjectMcVersionDialog({
  open,
  onClose,
  selectedCount,
  pending,
  onSubmit,
}: BatchProjectMcVersionDialogProps) {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Project.batch");

  const [operation, setOperation] = useState<"add" | "remove" | "set">("add");
  const [mcVersions, setMcVersions] = useState<string[]>([]);
  const [targetVersions, setTargetVersions] = useState<"all" | "latest">("latest");
  const [platforms, setPlatforms] = useState({ modparks: true, modrinth: true });

  const handleClose = () => {
    if (pending) return;
    setMcVersions([]);
    onClose();
  };

  const handleConfirm = async () => {
    if (mcVersions.length === 0) return;
    const ok = await onSubmit(operation, mcVersions, targetVersions, platforms);
    if (ok) {
      setMcVersions([]);
      onClose();
    }
  };

  const isConfirmDisabled = mcVersions.length === 0 || (!platforms.modparks && !platforms.modrinth);

  return (
    <AbstractDialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      title={t("editMcVersionsTitle")}
      onCancel={handleClose}
      onConfirm={handleConfirm}
      cancelText={tCommon("cancel")}
      confirmText={tCommon("save")}
      isSubmitting={pending}
      confirmDisabled={isConfirmDisabled}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3, pt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {t("editMcVersionsDesc", { count: selectedCount })}
        </Typography>

        <FormControl component="fieldset">
          <FormLabel component="legend" sx={{ fontWeight: 600, mb: 1, color: "text.primary" }}>
            {t("opType")}
          </FormLabel>
          <RadioGroup value={operation} onChange={(e) => setOperation(e.target.value as any)}>
            <FormControlLabel value="add" control={<Radio size="small" />} label={t("opAdd")} />
            <FormControlLabel value="remove" control={<Radio size="small" />} label={t("opRemove")} />
            <FormControlLabel value="set" control={<Radio size="small" />} label={t("opSet")} />
          </RadioGroup>
        </FormControl>

        <McVersionAutocomplete
          value={mcVersions}
          onChange={setMcVersions}
          label={tCommon("version") || "MC Version"}
          required
        />

        <FormControl component="fieldset">
          <FormLabel component="legend" sx={{ fontWeight: 600, mb: 1, color: "text.primary" }}>
            {t("targetVersions")}
          </FormLabel>
          <RadioGroup value={targetVersions} onChange={(e) => setTargetVersions(e.target.value as any)}>
            <FormControlLabel value="latest" control={<Radio size="small" />} label={t("targetLatest")} />
            <FormControlLabel value="all" control={<Radio size="small" />} label={t("targetAll")} />
          </RadioGroup>
        </FormControl>

        <FormControl component="fieldset">
          <FormLabel component="legend" sx={{ fontWeight: 600, mb: 1, color: "text.primary" }}>
            {t("targetPlatforms")}
          </FormLabel>
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={platforms.modparks}
                  onChange={(e) => setPlatforms((prev) => ({ ...prev, modparks: e.target.checked }))}
                  size="small"
                />
              }
              label={t("platformModParks")}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={platforms.modrinth}
                  onChange={(e) => setPlatforms((prev) => ({ ...prev, modrinth: e.target.checked }))}
                  size="small"
                />
              }
              label={t("platformModrinth")}
            />
          </FormGroup>
        </FormControl>
      </Box>
    </AbstractDialog>
  );
}
