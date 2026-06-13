"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Avatar from "@mui/material/Avatar";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import ExtensionIcon from "@mui/icons-material/Extension";
import { useState, useRef } from "react";
import { resizeImageFile } from "@/lib/utils/image";
import { useTranslations } from "next-intl";

export interface ProjectIconUploadProps {
  initialIconUrl?: string | null;
  projectSlug?: string;
}

export default function ProjectIconUpload({ initialIconUrl, projectSlug }: ProjectIconUploadProps) {
  const t = useTranslations("Project");
  const [iconUrl, setIconUrl] = useState<string>(initialIconUrl || "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      // 1. 画像の自動リサイズ (最大400x400)
      const resizedFile = await resizeImageFile(file, 400, 400);

      // 2. Presign URLの発行
      const presignRes = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: resizedFile.name,
          contentType: resizedFile.type,
          type: "icon",
          projectSlug: projectSlug || "new-project", // 新規時は仮のslugを使うか、後で更新する
        }),
      });

      if (!presignRes.ok) {
        throw new Error(t("iconUpload.error"));
      }

      const { uploadUrl, publicUrl } = await presignRes.json();

      // 3. R2へのアップロード
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": resizedFile.type },
        body: resizedFile,
      });

      if (!uploadRes.ok) throw new Error(t("iconUpload.error"));

      setIconUrl(publicUrl);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-start", mb: 3 }}>
      <Typography variant="subtitle2" color="text.secondary">
        {t("iconUpload.title")}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
        <Avatar
          src={iconUrl || undefined}
          variant="rounded"
          sx={{
            width: 80,
            height: 80,
            bgcolor: "primary.dark",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          {!iconUrl && <ExtensionIcon fontSize="large" />}
        </Avatar>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Button
            variant="outlined"
            component="label"
            disabled={uploading}
            size="small"
          >
            {uploading ? <CircularProgress size={20} /> : t("iconUpload.select")}
            <input
              type="file"
              hidden
              accept="image/png, image/jpeg, image/webp, image/gif"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
          </Button>
          {error && (
            <Typography variant="caption" color="error">
              {error}
            </Typography>
          )}
          <Typography variant="caption" color="text.disabled">
            {t("iconUpload.autoResizeNote")}
          </Typography>
        </Box>
      </Box>

      {/* フォーム送信用隠しフィールド */}
      <input type="hidden" name="iconUrl" value={iconUrl} />
    </Box>
  );
}
