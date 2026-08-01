"use client";

import { useTranslations } from "next-intl";
import { updatePostingSettings } from "@/lib/actions/settings";
import { useDirtyForm } from "@/lib/hooks/useDirtyForm";
import StickySaveBar from "@/components/ui/StickySaveBar";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import FormSelect from "@/components/ui/form/FormSelect";
import FormAutocomplete from "@/components/ui/form/FormAutocomplete";
import Alert from "@mui/material/Alert";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import { LICENSE_OPTIONS } from "@/lib/licenses";
import { useFlashMessage } from "@/lib/hooks/useFlashMessage";

interface Props {
  defaultProjectStatus: string;
  defaultIdeaStatus: string;
  defaultLicense: string;
  defaultCommentsEnabled: boolean;
  defaultRecipesEnabled: boolean;
}

export default function PostingTab({
  defaultProjectStatus,
  defaultIdeaStatus,
  defaultLicense,
  defaultCommentsEnabled,
  defaultRecipesEnabled,
}: Props) {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Settings");
  const { message, flash } = useFlashMessage();

  const form = useDirtyForm(
    {
      postingStatus: defaultProjectStatus || "draft",
      ideaStatus: defaultIdeaStatus || "public",
      postingLicense: defaultLicense || "All Rights Reserved",
      commentsEnabled: defaultCommentsEnabled,
      recipesEnabled: defaultRecipesEnabled,
    },
    async (values) => {
      await updatePostingSettings(
        values.postingStatus as any,
        values.ideaStatus as any,
        values.postingLicense,
        values.commentsEnabled,
        values.recipesEnabled
      );
      flash("success", t("posting.successUpdate"));
    }
  );
  const { postingStatus, ideaStatus, postingLicense, commentsEnabled, recipesEnabled } = form.values;
  const setField = form.setField;

  return (
    <Box sx={{ p: "2px" }}>
      {message && <Alert severity={message.type} sx={{ mb: 3 }}>{message.text}</Alert>}

      <Typography variant="h6" sx={{ mb: 2 }}>{t("posting.defaultProjectStatus")}</Typography>
      <Box sx={{ mb: 4, maxWidth: 300 }}>
        <FormSelect
          size="small"
          value={postingStatus}
          onChange={(e) => setField("postingStatus", e.target.value as string)}
          options={[
            { value: "draft", label: tCommon("visibility.draft") },
            { value: "public", label: tCommon("visibility.public") },
            { value: "unlisted", label: tCommon("visibility.unlisted") },
            { value: "private", label: tCommon("visibility.private") },
          ]}
        />
      </Box>

      <Typography variant="h6" sx={{ mb: 2 }}>{t("posting.defaultIdeaStatus")}</Typography>
      <Box sx={{ mb: 4, maxWidth: 300 }}>
        <FormSelect
          size="small"
          value={ideaStatus}
          onChange={(e) => setField("ideaStatus", e.target.value as string)}
          options={[
            { value: "draft", label: tCommon("visibility.draft") },
            { value: "public", label: tCommon("visibility.public") },
            { value: "unlisted", label: tCommon("visibility.unlisted") },
            { value: "private", label: tCommon("visibility.private") },
          ]}
        />
      </Box>

      <Typography variant="h6" sx={{ mb: 2 }}>{t("posting.defaultLicense")}</Typography>
      <FormAutocomplete
        freeSolo
        options={LICENSE_OPTIONS as unknown as string[]}
        value={postingLicense}
        onChange={(_, newValue) => setField("postingLicense", (newValue as string) || "MIT")}
        onInputChange={(_, newInputValue) => setField("postingLicense", newInputValue)}
        sx={{ mb: 4, maxWidth: 300 }}
        renderInputProps={{ size: "small", fullWidth: true }}
      />

      <Typography variant="h6" sx={{ mb: 2 }}>{t("posting.defaultFeatures")}</Typography>
      <Box sx={{ mb: 4, display: "flex", flexDirection: "column", gap: 1 }}>
        <FormControlLabel
          control={
            <Switch
              checked={commentsEnabled}
              onChange={(e) => setField("commentsEnabled", e.target.checked)}
            />
          }
          label={t("posting.defaultCommentsEnabled")}
        />
        <FormControlLabel
          control={
            <Switch
              checked={recipesEnabled}
              onChange={(e) => setField("recipesEnabled", e.target.checked)}
            />
          }
          label={t("posting.defaultRecipesEnabled")}
        />
      </Box>

      <StickySaveBar open={form.dirty} saving={form.saving} onSave={form.submit} onDiscard={form.reset} />
    </Box>
  );
}
