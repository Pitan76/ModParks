"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { updateProfile } from "@/lib/actions/settings";
import { useAvatarUpload } from "@/lib/hooks/useAvatarUpload";
import { useLinksEditor, parseLinks, type LinkItem } from "@/lib/hooks/useLinksEditor";
import { useDirtyForm } from "@/lib/hooks/useDirtyForm";
import StickySaveBar from "@/components/ui/StickySaveBar";
import AvatarUploadBadge from "@/components/common/AvatarUploadBadge";
import SettingsLink from "@/components/ui/SettingsLink";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import GitHubIcon from "@mui/icons-material/GitHub";
import { useFlashMessage } from "@/lib/hooks/useFlashMessage";

interface ProfileTabProps {
  user: { username: string; displayName: string; bio: string; avatarUrl: string; links: string };
  showGithubLink: boolean;
  githubUsername: string;
}

export default function ProfileTab({ user, showGithubLink, githubUsername }: ProfileTabProps) {
  const t = useTranslations("Settings");
  const { message, flash } = useFlashMessage();

  const form = useDirtyForm(
    {
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      links: parseLinks(user.links),
    },
    async (values) => {
      await updateProfile({
        displayName: values.displayName,
        bio: values.bio,
        avatarUrl: values.avatarUrl,
        links: JSON.stringify(values.links),
      });
      flash("success", t("profile.success"));
    }
  );
  const { displayName, bio, avatarUrl } = form.values;
  const setField = form.setField;

  const setLinks = useCallback(
    (updater: React.SetStateAction<LinkItem[]>) => setField("links", updater as LinkItem[]),
    [setField]
  );
  const { links, addLink, removeLink, changeLink, moveLink } = useLinksEditor(null, {
    links: form.values.links,
    setLinks,
  });

  const { uploading, fileInputRef, handleFileChange } = useAvatarUpload({
    onUploaded: (url: string) => setField("avatarUrl", url),
    onError: (msg) => flash("error", msg),
    errorMessages: { presign: t("profile.uploadError"), upload: t("profile.uploadFailed") },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    form.submit();
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ p: "2px" }}>
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

      <TextField label={t("profile.displayName")} fullWidth value={displayName} onChange={(e) => setField("displayName", e.target.value)} sx={{ mb: 3 }} />
      <TextField label={t("profile.bio")} fullWidth multiline rows={5} value={bio} onChange={(e) => setField("bio", e.target.value)} sx={{ mb: 3 }} />

      <Divider sx={{ my: 4 }} />
      <Typography variant="h6" sx={{ mb: 2 }}>{t("profile.customLinks")}</Typography>
      {showGithubLink && (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2, alignItems: { xs: "stretch", sm: "center" } }}>
          <TextField label={t("profile.linkTitle")} size="small" value="GitHub" disabled sx={{ width: { xs: "100%", sm: 150 } }} />
          <TextField label="URL" size="small" value={`https://github.com/${githubUsername}`} disabled slotProps={{ input: { startAdornment: <GitHubIcon fontSize="small" sx={{ mr: 1, opacity: 0.6 }} /> } }} sx={{ flex: 1 }} />
          <SettingsLink href="/settings/integration" label={t("integration.title")} sx={{ color: "text.secondary", flexShrink: 0 }} />
        </Stack>
      )}
      {links.map((link, idx) => (
        <Stack key={idx} direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2, alignItems: { xs: "stretch", sm: "center" } }}>
          <TextField label={t("profile.linkTitle")} size="small" value={link.title} onChange={(e) => changeLink(idx, "title", e.target.value)} sx={{ width: { xs: "100%", sm: 150 } }} />
          <TextField label="URL" size="small" value={link.url} onChange={(e) => changeLink(idx, "url", e.target.value)} sx={{ flex: 1 }} />
          <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end", flexShrink: 0 }}>
            <IconButton size="small" aria-label={t("profile.moveUp")} disabled={idx === 0} onClick={() => moveLink(idx, -1)}>
              <ArrowUpwardIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" aria-label={t("profile.moveDown")} disabled={idx === links.length - 1} onClick={() => moveLink(idx, 1)}>
              <ArrowDownwardIcon fontSize="small" />
            </IconButton>
            <IconButton color="error" size="small" aria-label={t("profile.removeLink")} onClick={() => removeLink(idx)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        </Stack>
      ))}
      <Button startIcon={<AddIcon />} variant="outlined" size="small" onClick={addLink} sx={{ mb: 4 }}>
        {t("profile.addLink")}
      </Button>

      <StickySaveBar open={form.dirty} saving={form.saving} onSave={form.submit} onDiscard={form.reset} />
    </Box>
  );
}
