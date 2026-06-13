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

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(null);
    try {
      // 1. Presign URLの発行
      const presignRes = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          type: "avatar"
        }),
      });
      if (!presignRes.ok) {
        const errorData = await presignRes.json();
        throw new Error(errorData.error || "アップロードの準備に失敗しました");
      }
      
      const { uploadUrl, publicUrl } = await presignRes.json();

      // 2. R2へのアップロード
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      
      if (!uploadRes.ok) throw new Error("画像のアップロードに失敗しました");

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

    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "プロフィールを更新しました" });
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
          <Typography variant="body2" color={initialData.hasGitHub ? "text.secondary" : "text.disabled"}>
            {initialData.hasGitHub ? "GitHub アカウントで連携済" : "GitHub 未連携"}
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
        rows={3}
        fullWidth
        slotProps={{ htmlInput: { maxLength: 500 } }}
        helperText="500文字以内"
      />
      <Button
        id="profile-save-btn"
        type="submit"
        variant="contained"
        disabled={pending}
      >
        {pending ? "保存中..." : "保存"}
      </Button>
    </Box>
  );
}
