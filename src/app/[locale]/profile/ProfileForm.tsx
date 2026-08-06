"use client";

import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import AvatarUploadBadge from "@/components/common/AvatarUploadBadge";
import { updateProfile } from "@/lib/actions/profile";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useAvatarUpload } from "@/lib/hooks/useAvatarUpload";
import { useFlashMessage } from "@/lib/hooks/useFlashMessage";
import { useTranslations } from "next-intl";
import GitHubIcon from "@mui/icons-material/GitHub";

interface ProfileFormProps {
  initialData: {
    displayName: string;
    bio: string;
    avatarUrl: string;
    username: string;
    hasGitHub: boolean;
  };
  labels: {
    displayName: string;
    bio: string;
  };
}

export default function ProfileForm({ initialData, labels }: ProfileFormProps) {
  const [pending, setPending] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(initialData.avatarUrl);
  const { message, flash, setMessage } = useFlashMessage();
  const router = useRouter();
  const t = useTranslations("Profile");
  const { update } = useSession();

  const { uploading, fileInputRef, handleFileChange } = useAvatarUpload({
    onUploaded: setAvatarUrl,
    onError: (msg) => flash("error", msg),
    errorMessages: { presign: t("uploadError"), upload: t("uploadFailed") },
  });

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    formData.set("avatarUrl", avatarUrl);

    const result = await updateProfile(formData);

    if (result && result.error) {
      flash("error", t("error." + result.error) || result.error);
    } else {
      await update();
      flash("success", t("updateSuccess"));
      router.refresh();
    }
    setPending(false);
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {message && <Alert severity={message.type}>{message.text}</Alert>}

      {/* アバター表示 */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
        <input
          type="file"
          accept="image/*"
          hidden
          ref={fileInputRef}
          onChange={handleFileChange}
        />
        <AvatarUploadBadge
          src={avatarUrl}
          alt={initialData.displayName}
          uploading={uploading}
          onEdit={handleAvatarClick}
        />
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            @{initialData.username}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <GitHubIcon fontSize="small" />
            {initialData.hasGitHub ? t("githubLinked") : t("githubNotLinked")}
          </Typography>
        </Box>
      </Box>

      <TextField
        id="profile-display-name"
        name="displayName"
        label={labels.displayName}
        defaultValue={initialData.displayName}
        fullWidth
        required
        slotProps={{ htmlInput: { maxLength: 64 } }}
      />
      <TextField
        id="profile-bio"
        name="bio"
        label={labels.bio}
        defaultValue={initialData.bio}
        multiline
        rows={4}
        fullWidth
        helperText={t("bioHelper")}
        slotProps={{ htmlInput: { maxLength: 500 } }}
      />
      <Button
        type="submit"
        variant="contained"
        disabled={pending}
      >
        {pending ? t("saving") : t("save")}
      </Button>
    </Box>
  );
}
