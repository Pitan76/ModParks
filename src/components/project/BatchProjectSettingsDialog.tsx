"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import Switch from "@mui/material/Switch";
import AbstractDialog from "@/components/ui/AbstractDialog";
import { LICENSE_OPTIONS } from "@/lib/licenses";
import { useTranslations } from "next-intl";
import type { BatchProjectSettingsUpdates } from "@/lib/actions/projectBatchSettings";

export type BatchProjectSettingsDialogProps = {
  open: boolean;
  onClose: () => void;
  selectedCount: number;
  pending: boolean;
  onSubmit: (updates: BatchProjectSettingsUpdates) => Promise<boolean>;
};

export default function BatchProjectSettingsDialog({
  open,
  onClose,
  selectedCount,
  pending,
  onSubmit,
}: BatchProjectSettingsDialogProps) {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Project.batch");

  // 各項目を更新対象にするかどうかの状態
  const [applyLicense, setApplyLicense] = useState(false);
  const [applyWebhook, setApplyWebhook] = useState(false);
  const [applyAiGenerated, setApplyAiGenerated] = useState(false);
  const [applyComments, setApplyComments] = useState(false);
  const [applyRecipes, setApplyRecipes] = useState(false);

  // 各項目の更新値
  const [license, setLicense] = useState("MIT");
  const [webhook, setWebhook] = useState("");
  const [aiGenerated, setAiGenerated] = useState(false);
  const [commentsEnabled, setCommentsEnabled] = useState(false);
  const [recipesEnabled, setRecipesEnabled] = useState(false);

  const handleClose = () => {
    if (pending) return;
    onClose();
  };

  const handleConfirm = async () => {
    const updates: BatchProjectSettingsUpdates = {};
    if (applyLicense) updates.license = license;
    if (applyWebhook) updates.discordWebhookUrl = webhook.trim() || null;
    if (applyAiGenerated) updates.aiGenerated = aiGenerated;
    if (applyComments) updates.commentsEnabled = commentsEnabled;
    if (applyRecipes) updates.recipesEnabled = recipesEnabled;

    if (Object.keys(updates).length === 0) return;
    const ok = await onSubmit(updates);
    if (ok) {
      onClose();
    }
  };

  const hasAnyChecked = applyLicense || applyWebhook || applyAiGenerated || applyComments || applyRecipes;
  const isConfirmDisabled = !hasAnyChecked || pending;

  return (
    <AbstractDialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      title={t("editSettingsTitle")}
      onCancel={handleClose}
      onConfirm={handleConfirm}
      cancelText={tCommon("cancel")}
      confirmText={tCommon("save")}
      isSubmitting={pending}
      confirmDisabled={isConfirmDisabled}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3.5, pt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {t("editSettingsDesc", { count: selectedCount })}
        </Typography>

        {/* 1. ライセンス */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <FormControlLabel
            control={<Checkbox checked={applyLicense} onChange={(e) => setApplyLicense(e.target.checked)} size="small" />}
            label={t("applyLicense")}
          />
          {applyLicense && (
            <Autocomplete
              freeSolo
              options={LICENSE_OPTIONS as unknown as string[]}
              value={license}
              onChange={(_, newValue) => setLicense(newValue || "MIT")}
              onInputChange={(_, newInputValue) => setLicense(newInputValue)}
              renderInput={(params) => <TextField {...params} label={tCommon("license") || "License"} size="small" fullWidth />}
            />
          )}
        </Box>

        {/* 2. Discord Webhook */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <FormControlLabel
            control={<Checkbox checked={applyWebhook} onChange={(e) => setApplyWebhook(e.target.checked)} size="small" />}
            label={t("applyDiscordWebhook")}
          />
          {applyWebhook && (
            <TextField
              label="Discord Webhook URL"
              placeholder="https://discord.com/api/webhooks/..."
              value={webhook}
              onChange={(e) => setWebhook(e.target.value)}
              size="small"
              fullWidth
            />
          )}
        </Box>

        {/* 3. AI生成コンテンツ */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <FormControlLabel
            control={<Checkbox checked={applyAiGenerated} onChange={(e) => setApplyAiGenerated(e.target.checked)} size="small" />}
            label={t("applyAiGenerated")}
          />
          {applyAiGenerated && (
            <FormControlLabel
              control={<Switch checked={aiGenerated} onChange={(e) => setAiGenerated(e.target.checked)} size="small" />}
              label="AI Generated"
              sx={{ ml: 3 }}
            />
          )}
        </Box>

        {/* 4. コメント有効化 */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <FormControlLabel
            control={<Checkbox checked={applyComments} onChange={(e) => setApplyComments(e.target.checked)} size="small" />}
            label={t("applyCommentsEnabled")}
          />
          {applyComments && (
            <FormControlLabel
              control={<Switch checked={commentsEnabled} onChange={(e) => setCommentsEnabled(e.target.checked)} size="small" />}
              label="Comments Enabled"
              sx={{ ml: 3 }}
            />
          )}
        </Box>

        {/* 5. レシピ表示 */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <FormControlLabel
            control={<Checkbox checked={applyRecipes} onChange={(e) => setApplyRecipes(e.target.checked)} size="small" />}
            label={t("applyRecipesEnabled")}
          />
          {applyRecipes && (
            <FormControlLabel
              control={<Switch checked={recipesEnabled} onChange={(e) => setRecipesEnabled(e.target.checked)} size="small" />}
              label="Recipes Enabled"
              sx={{ ml: 3 }}
            />
          )}
        </Box>
      </Box>
    </AbstractDialog>
  );
}
