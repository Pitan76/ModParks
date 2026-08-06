"use client";

import { useState } from "react";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ShareIcon from "@mui/icons-material/Share";
import XIcon from "@mui/icons-material/X";
import LinkIcon from "@mui/icons-material/Link";
import { useTranslations } from "next-intl";

export type ShareProvider = {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: (url: string, title: string, text?: string) => void | Promise<void>;
};

function useShareProviders(): ShareProvider[] {
  const t = useTranslations("ContextMenu");

  return [
    {
      id: "x",
      label: "X (Twitter)",
      icon: <XIcon fontSize="small" />,
      onClick: (url, title, text) => {
        const shareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(
          (text ? text + " - " : "") + title
        )}&url=${encodeURIComponent(url)}`;
        window.open(shareUrl, "_blank", "noopener");
      },
    },
    // ここに他のSNS（Facebook、LINEなど）を追加できます
    {
      id: "copy",
      label: t("copyLink"),
      icon: <LinkIcon fontSize="small" />,
      onClick: async (url) => {
        try {
          await navigator.clipboard.writeText(url);
          alert(t("copied"));
        } catch {
          // ignore
        }
      },
    },
  ];
}

export type ShareMenuButtonProps = {
  url: string;
  title: string;
  text?: string;
  variant?: "icon" | "button";
  /** カスタムのプロバイダリストを渡すことができます。未指定の場合はデフォルト(X, Copy)を使用します */
  providers?: ShareProvider[];
};

export default function ShareMenuButton({ url, title, text, variant = "icon", providers }: ShareMenuButtonProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const t = useTranslations("ContextMenu");
  const defaultProviders = useShareProviders();
  const activeProviders = providers || defaultProviders;
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleProviderClick = async (provider: ShareProvider) => {
    await provider.onClick(url, title, text);
    handleClose();
  };

  return (
    <>
      <Tooltip title={t("share")}>
        <IconButton onClick={handleClick}>
          <ShareIcon />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
      >
        {activeProviders.map((provider) => (
          <MenuItem key={provider.id} onClick={() => handleProviderClick(provider)}>
            <ListItemIcon>{provider.icon}</ListItemIcon>
            <ListItemText>{provider.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
