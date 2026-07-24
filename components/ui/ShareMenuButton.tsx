"use client";

import { useState } from "react";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ShareIcon from "@mui/icons-material/Share";
import XIcon from "@mui/icons-material/X";
import LinkIcon from "@mui/icons-material/Link";
import { useTranslations } from "next-intl";

export type ShareMenuButtonProps = {
  url: string;
  title: string;
  text?: string;
  variant?: "icon" | "button";
};

export default function ShareMenuButton({ url, title, text, variant = "icon" }: ShareMenuButtonProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const t = useTranslations("Common");
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleShareX = () => {
    const shareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(
      (text ? text + " - " : "") + title
    )}&url=${encodeURIComponent(url)}`;
    window.open(shareUrl, "_blank", "noopener");
    handleClose();
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      alert(t("copied"));
    } catch {
      // ignore
    }
    handleClose();
  };

  return (
    <>
      <IconButton onClick={handleClick} title={t("share")}>
        <ShareIcon />
      </IconButton>
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
        <MenuItem onClick={handleShareX}>
          <ListItemIcon>
            <XIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>X (Twitter)</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleCopyLink}>
          <ListItemIcon>
            <LinkIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("copyLink")}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
