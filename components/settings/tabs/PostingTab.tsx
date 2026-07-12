"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { updatePostingSettings } from "@/lib/actions/settings";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import { LICENSE_OPTIONS } from "@/lib/licenses";
import { useFlashMessage } from "@/lib/hooks/useFlashMessage";

interface PostingTabProps {
  defaultProjectStatus: string;
  defaultLicense: string;
}

export default function PostingTab({ defaultProjectStatus, defaultLicense }: PostingTabProps) {
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
      <FormControl fullWidth sx={{ mb: 4, maxWidth: 300 }}>
        <Select size="small" value={postingStatus} onChange={(e) => setPostingStatus(e.target.value)}>
          <MenuItem value="draft">{t("posting.statusDraft")}</MenuItem>
          <MenuItem value="public">{t("posting.statusPublic")}</MenuItem>
          <MenuItem value="unlisted">{t("posting.statusUnlisted")}</MenuItem>
          <MenuItem value="private">{t("posting.statusPrivate")}</MenuItem>
        </Select>
      </FormControl>

      <Typography variant="h6" sx={{ mb: 1 }}>{t("posting.defaultLicense")}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t("posting.defaultLicenseDesc")}</Typography>
      <Autocomplete
        freeSolo
        options={LICENSE_OPTIONS as unknown as string[]}
        value={postingLicense}
        onChange={(_, newValue) => setPostingLicense(newValue || "MIT")}
        onInputChange={(_, newInputValue) => setPostingLicense(newInputValue)}
        sx={{ mb: 4, maxWidth: 300 }}
        renderInput={(params) => <TextField {...params} size="small" fullWidth />}
      />

      <Button type="submit" variant="contained" sx={{ display: "block" }}>{t("profile.save")}</Button>
    </Box>
  );
}
