"use client";

import { useState, useRef, useTransition } from "react";
import Avatar from "@mui/material/Avatar";
import ExtensionIcon from "@mui/icons-material/Extension";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { resizeImageFile } from "@/lib/utils/image";
import { updateProjectIcon } from "@/lib/actions/project";
import { useRouter } from "next/navigation";

export interface EditableProjectIconProps {
  projectId: string;
  projectSlug: string;
  projectName: string;
  initialIconUrl?: string | null;
  canEdit: boolean;
}

export default function EditableProjectIcon({ projectId, projectSlug, projectName, initialIconUrl, canEdit }: EditableProjectIconProps) {
  const [iconUrl, setIconUrl] = useState<string>(initialIconUrl || "");
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      // 1. リサイズ
      const resizedFile = await resizeImageFile(file, 400, 400);

      // 2. Presign URLの発行
      const presignRes = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: resizedFile.name,
          contentType: resizedFile.type,
          type: "icon",
          projectSlug: projectSlug,
        }),
      });

      if (!presignRes.ok) {
        throw new Error("Failed to get presigned URL");
      }

      const { uploadUrl, publicUrl } = (await presignRes.json()) as { uploadUrl: string, publicUrl: string };

      // 3. アップロード
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": resizedFile.type },
        body: resizedFile,
      });

      if (!uploadRes.ok) throw new Error("Failed to upload image to R2");

      // 4. DB更新
      setIconUrl(publicUrl);
      
      startTransition(async () => {
        await updateProjectIcon(projectId, publicUrl);
        router.refresh();
      });

    } catch (err: any) {
      console.error(err);
      alert("アップロードに失敗しました。");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <Box 
      sx={{ 
        position: "relative",
        cursor: canEdit ? "pointer" : "default",
        "&:hover .overlay": canEdit ? { opacity: 1 } : {},
      }}
      onClick={() => {
        if (canEdit && fileInputRef.current && !uploading) {
          fileInputRef.current.click();
        }
      }}
    >
      <Avatar
        src={iconUrl || undefined}
        alt={projectName}
        variant="rounded"
        sx={{
          width: { xs: 60, sm: 80 }, height: { xs: 60, sm: 80 }, bgcolor: "primary.dark",
          border: "2px solid", borderColor: "divider",
          opacity: uploading ? 0.5 : 1,
        }}
      >
        {!iconUrl && <ExtensionIcon sx={{ fontSize: { xs: 30, sm: 40 } }} />}
      </Avatar>

      {canEdit && (
        <Box
          className="overlay"
          sx={{
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            bgcolor: "rgba(0,0,0,0.4)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0,
            transition: "opacity 0.2s",
            borderRadius: "10px",
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: "bold" }}>変更</Typography>
        </Box>
      )}

      {uploading && (
        <CircularProgress 
          size={24} 
          sx={{ position: "absolute", top: "50%", left: "50%", mt: "-12px", ml: "-12px" }} 
        />
      )}

      <input 
        type="file" 
        accept="image/png, image/jpeg, image/gif, image/webp"
        style={{ display: "none" }}
        ref={fileInputRef}
        onChange={handleFileChange}
      />
    </Box>
  );
}
