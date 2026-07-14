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
import { LICENSE_OPTIONS } from "@/lib/licenses";
import { useFlashMessage } from "@/lib/hooks/useFlashMessage";

interface Props {
  defaultProjectStatus: string;
  defaultLicense: string;
}

export default function PostingTab({ defaultProjectStatus, defaultLicense }: Props) {
  const t = useTranslations("Settings");
  const { message, flash } = useFlashMessage();

  const [postingStatus, setPostingStatus] = useState(defaultProjectStatus || "draft");
  const [postingLicense, setPostingLicense] = useState(defaultLicense || "All Rights Reserved");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updatePostingSettings(postingStatus as any, postingLicense);
    flash("success", t("posting.successUpdate"));
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      {message && <Alert severity={message.type} sx={{ mb: 3 }}>{message.text}</Alert>}

      <Typography variant="h6" sx={{ mb: 1 }}>{t("posting.defaultProjectStatus")}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t("posting.defaultProjectStatusDesc")}</Typography>
      <Box sx={{ mb: 4, maxWidth: 300 }}>
        <FormSelect
          size="small"
          value={postingStatus}
          onChange={(e) => setPostingStatus(e.target.value as string)}
          options={[
            { value: "draft", label: t("posting.statusDraft") },
            { value: "public", label: t("posting.statusPublic") },
            { value: "unlisted", label: t("posting.statusUnlisted") },
            { value: "private", label: t("posting.statusPrivate") },
          ]}
        />
      </Box>

      <Typography variant="h6" sx={{ mb: 1 }}>{t("posting.defaultLicense")}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t("posting.defaultLicenseDesc")}</Typography>
      <FormAutocomplete
        freeSolo
        options={LICENSE_OPTIONS as unknown as string[]}
        value={postingLicense}
        onChange={(_, newValue) => setPostingLicense((newValue as string) || "MIT")}
        onInputChange={(_, newInputValue) => setPostingLicense(newInputValue)}
        sx={{ mb: 4, maxWidth: 300 }}
        renderInputProps={{ size: "small", fullWidth: true }}
      />

      <Button type="submit" variant="contained" sx={{ display: "block" }}>{t("profile.save")}</Button>
    </Box>
  );
}
