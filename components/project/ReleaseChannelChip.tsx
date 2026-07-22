"use client";

import BaseBadge from "@/components/ui/BaseBadge";
import { useTranslations } from "next-intl";
import { DEFAULT_RELEASE_CHANNEL, getChannelColor, normalizeReleaseChannel } from "@/lib/releaseChannels";

type ReleaseChannelChipProps = {
  channel: string;
  size?: "small" | "medium";
  variant?: "filled" | "outlined";
};

/**
 * バージョンのリリースチャネル（release / beta / alpha）を表すチップ。
 * 安定版(release)は既定表示のため描画しない。
 */
const ReleaseChannelChip = ({ channel, size = "small", variant = "filled" }: ReleaseChannelChipProps) => {
  const t = useTranslations("Version");

  const normalized = normalizeReleaseChannel(channel);

  if (!normalized || normalized === DEFAULT_RELEASE_CHANNEL) return null;

  return (
    <BaseBadge
      label={t(`channels.${normalized}`)}
      size={size}
      color={getChannelColor(normalized)}
      variant={variant}
      sx={{ borderRadius: "4px", fontWeight: 600 }}
    />
  );
};

export default ReleaseChannelChip;
