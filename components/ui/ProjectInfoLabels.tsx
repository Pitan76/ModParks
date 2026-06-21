"use client";

import Box, { BoxProps } from "@mui/material/Box";
import Typography, { TypographyProps } from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import Avatar from "@mui/material/Avatar";
import DownloadIcon from "@mui/icons-material/Download";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import EditIcon from "@mui/icons-material/Edit";
import { formatCompactNumber } from "@/lib/utils/format";
import { useLocale, useTranslations, useFormatter } from "next-intl";
import LinkButton from "@/components/ui/LinkButton";

export interface AuthorLabelProps {
  author: {
    username?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
  avatarSize?: number;
  textVariant?: TypographyProps["variant"];
  textColor?: string;
  sx?: object;
}

export function AuthorLabel({
  author,
  avatarSize = 22,
  textVariant = "body2",
  textColor = "text.secondary",
  sx,
}: AuthorLabelProps) {
  const username = author.username || "Unknown";
  const displayName = author.displayName || username;

  return (
    <LinkButton
      href={`/profile/${username}`}
      variant="text"
      sx={{
        p: 0,
        minWidth: "auto",
        textTransform: "none",
        color: textColor,
        display: "flex",
        alignItems: "center",
        gap: 1,
        "&:hover": { color: "primary.main", bgcolor: "transparent" },
        ...sx,
      }}
    >
      <Avatar src={author.avatarUrl ?? undefined} sx={{ width: avatarSize, height: avatarSize }} />
      <Typography variant={textVariant} sx={{ fontWeight: 500 }}>
        {displayName}
      </Typography>
    </LinkButton>
  );
}

export interface DownloadLabelProps extends Omit<BoxProps, "children"> {
  downloads: number;
  totalDownloads?: number;
  externalDownloads?: Record<string, number> | null;
  modrinthId?: string | null;
  curseforgeId?: string | null;
  iconSize?: number | string;
  textVariant?: TypographyProps["variant"];
  textColor?: string;
  iconColor?: string;
}

export function DownloadLabel({
  downloads,
  totalDownloads,
  externalDownloads,
  modrinthId,
  curseforgeId,
  iconSize = 14,
  textVariant = "body2",
  textColor = "text.disabled",
  iconColor = "text.disabled",
  sx,
  ...props
}: DownloadLabelProps) {
  const locale = useLocale();
  const tProject = useTranslations("Project");

  const extDl = externalDownloads || {};
  const modrinthDl = extDl.modrinth || 0;
  const curseforgeDl = extDl.curseforge || 0;
  const computedTotal = totalDownloads ?? (downloads + modrinthDl + curseforgeDl);

  const modparksLabel = tProject("stats.modparks");
  let tooltipText = `${modparksLabel}: ${formatCompactNumber(downloads, locale)}`;
  if (modrinthDl > 0) tooltipText += `, Modrinth: ${formatCompactNumber(modrinthDl, locale)}`;
  if (curseforgeDl > 0) tooltipText += `, CurseForge: ${formatCompactNumber(curseforgeDl, locale)}`;

  if (modrinthDl === 0 && curseforgeDl === 0 && (extDl.native || 0) > 0) {
    let extLabel = tProject("stats.external");
    if (modrinthId && !curseforgeId) extLabel = "Modrinth";
    else if (!modrinthId && curseforgeId) extLabel = "CurseForge";
    tooltipText += `, ${extLabel}: ${formatCompactNumber(extDl.native || 0, locale)}`;
  }

  const hasExt = Object.keys(extDl).length > 0;

  return (
    <Tooltip title={hasExt ? tooltipText : `${modparksLabel}: ${formatCompactNumber(downloads, locale)}`} arrow placement="top">
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, cursor: "help", color: textColor, ...sx }} {...props}>
        <DownloadIcon sx={{ fontSize: iconSize, color: iconColor }} />
        <Typography variant={textVariant} sx={{ fontWeight: 500, color: "inherit" }}>
          {formatCompactNumber(computedTotal, locale)}
        </Typography>
      </Box>
    </Tooltip>
  );
}

export interface DateLabelProps extends Omit<BoxProps, "children"> {
  date: Date | number;
  type: "published" | "updated";
  iconSize?: number | string;
  textVariant?: TypographyProps["variant"];
  textColor?: string;
  hideIcon?: boolean;
}

export function DateLabel({
  date,
  type,
  iconSize = 14,
  textVariant = "caption",
  textColor = "text.secondary",
  hideIcon = false,
  sx,
  ...props
}: DateLabelProps) {
  const format = useFormatter();
  const tProject = useTranslations("Project");
  const dateObj = new Date(date);

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: hideIcon ? 0 : 0.5, color: textColor, ...sx }} {...props}>
      {!hideIcon && (
        type === "published" ? (
          <AccessTimeIcon sx={{ fontSize: iconSize }} />
        ) : (
          <EditIcon sx={{ fontSize: iconSize }} />
        )
      )}
      <Typography variant={textVariant} sx={{ whiteSpace: "nowrap", color: "inherit" }}>
        {tProject(type === "published" ? "header.publishedAt" : "header.updatedAt", {
          date: format.dateTime(dateObj, { dateStyle: "short" }),
        })}
      </Typography>
    </Box>
  );
}
