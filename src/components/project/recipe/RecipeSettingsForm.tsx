"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { setRecipeSettingsAction } from "@/lib/actions/projectRecipe";
import {
  MAX_CROP,
  normalizeCrop,
  parseNamespaceList,
  toNamespaceInput,
  type RecipeSettings,
} from "@/lib/recipe/settings";

/** 選べるクリップ量（ネイティブpx）。 */
const CROP_CHOICES = Array.from({ length: MAX_CROP + 1 }, (_, n) => n);

export type RecipeSettingsFormProps = {
  projectSlug: string;
  settings: RecipeSettings;
  onError: (message: string) => void;
};

/**
 * レシピ画像の見せ方の設定。
 *
 * 個別レシピの表示・非表示とは対象が違う（プロジェクト全体に効く）ため、一覧とは分けて置きます。
 */
const RecipeSettingsForm = ({ projectSlug, settings, onError }: RecipeSettingsFormProps) => {
  const t = useTranslations("Project.recipeManager.settings");
  const [tagNs, setTagNs] = useState(() => toNamespaceInput(settings));
  const [crop, setCrop] = useState(() => normalizeCrop(settings.crop));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setBusy(true);
    setSaved(false);
    const result = await setRecipeSettingsAction(projectSlug, { tagNs: parseNamespaceList(tagNs), crop });
    setBusy(false);

    if (result.error) return onError(result.error);
    setSaved(true);
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {t("title")}
      </Typography>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "flex-start" } }}>
        <TextField
          size="small"
          label={t("tagNs")}
          value={tagNs}
          onChange={(e) => setTagNs(e.target.value)}
          placeholder="create, farmersdelight"
          helperText={t("tagNsHelp")}
          sx={{ flexGrow: 1 }}
        />
        <TextField
          size="small"
          select
          label={t("crop")}
          value={crop}
          onChange={(e) => setCrop(Number(e.target.value))}
          helperText={t("cropHelp")}
          sx={{ width: { sm: 160 } }}
        >
          {CROP_CHOICES.map((value) => (
            <MenuItem key={value} value={value}>{`${value} px`}</MenuItem>
          ))}
        </TextField>
        <Button variant="contained" onClick={save} disabled={busy} sx={{ mt: { sm: 0.5 } }}>
          {saved && !busy ? t("saved") : t("save")}
        </Button>
      </Stack>
    </Box>
  );
};

export default RecipeSettingsForm;
