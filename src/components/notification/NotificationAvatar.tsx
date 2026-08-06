"use client";

import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import ChatBubbleIcon from "@mui/icons-material/ChatBubble";
import ReplyIcon from "@mui/icons-material/Reply";
import FavoriteIcon from "@mui/icons-material/Favorite";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import NewReleasesIcon from "@mui/icons-material/NewReleases";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import NotificationsIcon from "@mui/icons-material/Notifications";
import SecurityIcon from "@mui/icons-material/Security";
import GavelIcon from "@mui/icons-material/Gavel";
import type { SvgIconComponent } from "@mui/icons-material";
import type { Notification } from "@/db/schema";

/**
 * 通知の発信元を表すアバター。
 * 人が起点の通知（コメント・お気に入り・フォロー等）は操作者のアバターを、
 * システム起点（新バージョン・新規公開）はプロジェクトアイコンを表示し、
 * どちらも無ければ ModParks のアイコンにフォールバックする。
 * 右下には種別を表すバッジを重ねる（Web Push 側のアイコン選択と同じ考え方）。
 */

const TYPE_ICONS: Record<string, SvgIconComponent> = {
  comment: ChatBubbleIcon,
  comment_reply: ReplyIcon,
  favorite: FavoriteIcon,
  follow: PersonAddIcon,
  list_add: PlaylistAddIcon,
  new_version: NewReleasesIcon,
  new_project: AutoAwesomeIcon,
  scan_result: SecurityIcon,
  scan_appeal_result: GavelIcon,
};

interface Props {
  notification: Notification;
  size?: number;
}

export default function NotificationAvatar({ notification, size = 40 }: Props) {
  const p = (notification.payload ?? {}) as Record<string, string>;
  const actorImage = p.actorImage;
  // actorName があれば人起因。無ければシステム（購読ベース）の通知として扱う
  const fromUser = Boolean(p.actorName || p.actorUsername);
  const src = actorImage || (fromUser ? undefined : p.iconUrl || "/icon.png");
  const BadgeIcon = TYPE_ICONS[notification.type] ?? NotificationsIcon;
  const badgeSize = Math.round(size * 0.5);

  return (
    <Box sx={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <Avatar
        src={src}
        alt={p.actorName || p.title || "ModParks"}
        variant={fromUser ? "circular" : "rounded"}
        sx={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        {p.actorName?.charAt(0) ?? ""}
      </Avatar>
      <Box
        sx={{
          position: "absolute",
          right: -2,
          bottom: -2,
          width: badgeSize,
          height: badgeSize,
          borderRadius: "50%",
          bgcolor: fromUser ? "primary.main" : "text.secondary",
          color: "primary.contrastText",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: 2,
          borderColor: "background.paper",
        }}
      >
        <BadgeIcon sx={{ fontSize: badgeSize * 0.6 }} />
      </Box>
    </Box>
  );
}
