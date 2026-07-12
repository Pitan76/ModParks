"use client";

import Avatar from "@mui/material/Avatar";
import Badge from "@mui/material/Badge";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import EditIcon from "@mui/icons-material/Edit";

export interface AvatarUploadBadgeProps {
  src: string;
  alt: string;
  uploading: boolean;
  onEdit: () => void;
  size?: number;
}

/**
 * アバター画像 + 右下の編集ボタンを重ねた表示専用コンポーネント。
 * ファイル選択やアップロード処理は呼び出し側が持つ（onEdit で発火）。
 */
export default function AvatarUploadBadge({ src, alt, uploading, onEdit, size = 80 }: AvatarUploadBadgeProps) {
  return (
    <Badge
      overlap="circular"
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      badgeContent={
        <IconButton
          size="small"
          onClick={onEdit}
          disabled={uploading}
          sx={{ bgcolor: "background.paper", boxShadow: 1, "&:hover": { bgcolor: "action.hover" } }}
        >
          {uploading ? <CircularProgress size={16} /> : <EditIcon fontSize="small" />}
        </IconButton>
      }
    >
      <Avatar
        src={src}
        alt={alt}
        sx={{ width: size, height: size, cursor: uploading ? "wait" : "pointer" }}
        onClick={onEdit}
      />
    </Badge>
  );
}
