"use client";

import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
import Badge from "@mui/material/Badge";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import EditIcon from "@mui/icons-material/Edit";
import { useState, useRef } from "react";
import { updateProfile } from "@/lib/actions/profile";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { resizeImageFile } from "@/lib/utils/image";
import { uploadFileToR2 } from "@/lib/utils/upload";
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
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(initialData.avatarUrl);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const t = useTranslations("Profile");
  const { update } = useSession();

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(null);
    try {
      // 画像の自動リサイズ (最大400x400) 後に R2 へアップロード
      const resizedFile = await resizeImageFile(file, 400, 400);
      const { publicUrl } = await uploadFileToR2(resizedFile, { type: "avatar" }, {
        presignError: t("uploadError"),
        uploadError: t("uploadFailed"),
      });
      setAvatarUrl(publicUrl);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    formData.set("avatarUrl", avatarUrl);
    
    const result = await updateProfile(formData);

    if (result && result.error) {
      setMessage({ type: "error", text: t("error." + result.error) || result.error });
    } else {
      await update();
      setMessage({ type: "success", text: t("updateSuccess") });
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
        <Badge
          overlap="circular"
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          badgeContent={
            <IconButton 
              size="small" 
              onClick={handleAvatarClick}
              disabled={uploading}
              sx={{ bgcolor: "background.paper", boxShadow: 1, "&:hover": { bgcolor: "action.hover" } }}
            >
              {uploading ? <CircularProgress size={16} /> : <EditIcon fontSize="small" />}
            </IconButton>
          }
        >
          <Avatar
            src={avatarUrl}
            alt={initialData.displayName}
            sx={{ width: 80, height: 80, cursor: uploading ? "wait" : "pointer" }}
            onClick={handleAvatarClick}
          />
        </Badge>
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
