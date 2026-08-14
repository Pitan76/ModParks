"use client";

import { useState } from "react";
import Avatar from "@mui/material/Avatar";
import Badge from "@mui/material/Badge";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import Snackbar from "@mui/material/Snackbar";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import { useRouter } from "@/lib/i18n/routing";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useAvatarUpload } from "@/lib/hooks/useAvatarUpload";
import { updateAvatar } from "@/lib/actions/settings";

interface ProfileAvatarProps {
  initialSrc: string;
  alt: string;
  isOwner: boolean;
  size?: number;
}

/**
 * プロフィールのアバター。本人の場合はタップで画像を変更できる
 * （プロジェクトのアイコン変更と同様の挙動）。閲覧者には通常の Avatar を表示する。
 */
export default function ProfileAvatar({ initialSrc, alt, isOwner, size = 100 }: ProfileAvatarProps) {
  const t = useTranslations("Profile");
  const router = useRouter();
  const { update } = useSession();
  const [src, setSrc] = useState(initialSrc);
  const [toast, setToast] = useState<string | null>(null);

  const { uploading, fileInputRef, handleFileChange } = useAvatarUpload({
    onUploaded: async (url) => {
      setSrc(url);
      await updateAvatar(url);
      await update();
      setToast(t("updateSuccess"));
      router.refresh();
    },
    onError: (msg) => setToast(msg),
    errorMessages: { presign: t("uploadError"), upload: t("uploadFailed") },
  });

  const avatarSx = {
    width: { xs: 88, sm: size },
    height: { xs: 88, sm: size },
    flexShrink: 0,
  } as const;

  if (!isOwner) {
    return <Avatar src={src || ""} alt={alt} sx={avatarSx} />;
  }

  return (
    <>
      <input type="file" accept="image/*" hidden ref={fileInputRef} onChange={handleFileChange} />
      <Badge
        overlap="circular"
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        badgeContent={
          <IconButton
            size="small"
            aria-label={t("changeAvatar")}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            sx={{ bgcolor: "background.paper", boxShadow: 1, "&:hover": { bgcolor: "action.hover" } }}
          >
            {uploading ? <CircularProgress size={16} /> : <PhotoCameraIcon fontSize="small" />}
          </IconButton>
        }
      >
        <Avatar
          src={src || ""}
          alt={alt}
          onClick={() => !uploading && fileInputRef.current?.click()}
          sx={{ ...avatarSx, cursor: uploading ? "wait" : "pointer" }}
        />
      </Badge>
      <Snackbar
        open={toast !== null}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        message={toast ?? ""}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </>
  );
}
