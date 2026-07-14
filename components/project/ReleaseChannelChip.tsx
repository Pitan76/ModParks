"use client";

import Chip from "@mui/material/Chip";
import { useTranslations } from "next-intl";
import { DEFAULT_RELEASE_CHANNEL, getChannelColor } from "@/lib/releaseChannels";

interface ReleaseChannelChipProps {
  channel: string;
  size?: "small" | "medium";
}

/**
 * バージョンのリリースチャネル（release / beta / alpha）を表すチップ。
 * 安定版(release)は既定表示のため描画しない。
 */
export default function ReleaseChannelChip({ channel, size = "small" }: ReleaseChannelChipProps) {
  const t = useTranslations("Version");

  if (!channel || channel === DEFAULT_RELEASE_CHANNEL) return null;

  return (
    <Chip
      label={t(`channels.${channel}`)}
      size={size}
      color={getChannelColor(channel)}
      sx={{ borderRadius: "4px", fontWeight: 600 }}
    />
  );
}
