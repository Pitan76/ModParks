"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { updatePostingSettings } from "@/lib/actions/settings";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import FormSelect from "@/components/ui/form/FormSelect";
import FormAutocomplete from "@/components/ui/form/FormAutocomplete";
import Button from "@mui/material/Button";
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

  const [postingStatus, setPostingStatus] = useState(defaultProjectStatus || "draft");
  const [ideaStatus, setIdeaStatus] = useState(defaultIdeaStatus || "public");
  const [postingLicense, setPostingLicense] = useState(defaultLicense || "All Rights Reserved");
  const [commentsEnabled, setCommentsEnabled] = useState(defaultCommentsEnabled);
  const [recipesEnabled, setRecipesEnabled] = useState(defaultRecipesEnabled);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updatePostingSettings(
      postingStatus as any,
      ideaStatus as any,
      postingLicense,
      commentsEnabled,
      recipesEnabled
    );
    flash("success", t("posting.successUpdate"));
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ p: "2px" }}>
      {message && <Alert severity={message.type} sx={{ mb: 3 }}>{message.text}</Alert>}

      <Typography variant="h6" sx={{ mb: 2 }}>{t("posting.defaultProjectStatus")}</Typography>
      <Box sx={{ mb: 4, maxWidth: 300 }}>
        <FormSelect
          size="small"
          value={postingStatus}
          onChange={(e) => setPostingStatus(e.target.value as string)}
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
          onChange={(e) => setIdeaStatus(e.target.value as string)}
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
        onChange={(_, newValue) => setPostingLicense((newValue as string) || "MIT")}
        onInputChange={(_, newInputValue) => setPostingLicense(newInputValue)}
        sx={{ mb: 4, maxWidth: 300 }}
        renderInputProps={{ size: "small", fullWidth: true }}
      />

      <Typography variant="h6" sx={{ mb: 2 }}>{t("posting.defaultFeatures")}</Typography>
      <Box sx={{ mb: 4, display: "flex", flexDirection: "column", gap: 1 }}>
        <FormControlLabel
          control={
            <Switch
              checked={commentsEnabled}
              onChange={(e) => setCommentsEnabled(e.target.checked)}
            />
          }
          label={t("posting.defaultCommentsEnabled")}
        />
        <FormControlLabel
          control={
            <Switch
              checked={recipesEnabled}
              onChange={(e) => setRecipesEnabled(e.target.checked)}
            />
          }
          label={t("posting.defaultRecipesEnabled")}
        />
      </Box>

      <Button type="submit" variant="contained" sx={{ display: "block" }}>{t("profile.save")}</Button>
    </Box>
  );
}
