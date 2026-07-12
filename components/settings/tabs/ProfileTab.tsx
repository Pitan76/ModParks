"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { updateProfile } from "@/lib/actions/settings";
import { useAvatarUpload } from "@/lib/hooks/useAvatarUpload";
import { useLinksEditor } from "@/lib/hooks/useLinksEditor";
import AvatarUploadBadge from "@/components/common/AvatarUploadBadge";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { useFlashMessage } from "../useFlashMessage";

interface ProfileTabProps {
  user: { username: string; displayName: string; bio: string; avatarUrl: string; links: string };
  locale: "ja" | "en";
}

export default function ProfileTab({ user, locale }: ProfileTabProps) {
  const t = useTranslations("Settings");
  const { message, flash } = useFlashMessage();

  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);

  const { links, addLink, removeLink, changeLink } = useLinksEditor(user.links);

  const { uploading, fileInputRef, handleFileChange } = useAvatarUpload({
    onUploaded: setAvatarUrl,
    onError: (msg) => flash("error", msg),
    errorMessages: { presign: t("profile.uploadError"), upload: t("profile.uploadFailed") },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({ displayName, bio, avatarUrl, links: JSON.stringify(links), locale });
    flash("success", t("profile.success"));
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      {message && <Alert severity={message.type} sx={{ mb: 3 }}>{message.text}</Alert>}

      <Box sx={{ display: "flex", alignItems: "center", gap: 3, mb: 4 }}>
        <input type="file" accept="image/*" hidden ref={fileInputRef} onChange={handleFileChange} />
        <AvatarUploadBadge
          src={avatarUrl}
          alt={displayName}
          uploading={uploading}
          onEdit={() => fileInputRef.current?.click()}
        />
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>@{user.username}</Typography>
        </Box>
      </Box>

      <TextField label={t("profile.displayName")} fullWidth value={displayName} onChange={(e) => setDisplayName(e.target.value)} sx={{ mb: 3 }} />
      <TextField label={t("profile.bio")} fullWidth multiline rows={5} value={bio} onChange={(e) => setBio(e.target.value)} sx={{ mb: 3 }} />

      <Divider sx={{ my: 4 }} />
      <Typography variant="h6" sx={{ mb: 2 }}>{t("profile.customLinks")}</Typography>
      {links.map((link, idx) => (
        <Box key={idx} sx={{ display: "flex", gap: 2, mb: 2, alignItems: "center" }}>
          <TextField label={t("profile.linkTitle")} size="small" value={link.title} onChange={(e) => changeLink(idx, "title", e.target.value)} sx={{ width: 150 }} />
          <TextField label="URL" size="small" value={link.url} onChange={(e) => changeLink(idx, "url", e.target.value)} sx={{ flex: 1 }} />
          <IconButton color="error" onClick={() => removeLink(idx)}>
            <DeleteIcon />
          </IconButton>
        </Box>
      ))}
      <Button startIcon={<AddIcon />} variant="outlined" size="small" onClick={addLink} sx={{ mb: 4 }}>
        {t("profile.addLink")}
      </Button>

      <Button type="submit" variant="contained" sx={{ height: 40, display: "block" }}>{t("profile.save")}</Button>
    </Box>
  );
}
