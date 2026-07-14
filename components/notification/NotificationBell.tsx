"use client";

import * as React from "react";
import IconButton from "@mui/material/IconButton";
import Badge from "@mui/material/Badge";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import NotificationsIcon from "@mui/icons-material/Notifications";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import type { Notification } from "@/db/schema";
import { renderNotification } from "./renderNotification";
import { markAllNotificationsRead } from "@/lib/actions/notification";

const POLL_INTERVAL_MS = 60_000;

export default function NotificationBell() {
  const t = useTranslations("Notifications");
  const router = useRouter();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [items, setItems] = React.useState<Notification[]>([]);
  const [unread, setUnread] = React.useState(0);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items ?? []);
      setUnread(data.unreadCount ?? 0);
    } catch {
      // ポーリングの失敗は無視
    }
  }, []);

  React.useEffect(() => {
    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [load]);

  const handleOpen = async (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
    if (unread > 0) {
      setUnread(0);
      await markAllNotificationsRead();
    }
  };

  const handleClose = () => setAnchorEl(null);

  const goTo = (href: string) => {
    handleClose();
    router.push(href);
  };

  return (
    <>
      <Tooltip title={t("title")}>
        <IconButton id="notification-bell" onClick={handleOpen} color="inherit" size="small" sx={{ mr: 0.5 }}>
          <Badge color="error" variant="dot" invisible={unread === 0} overlap="circular">
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        slotProps={{ paper: { sx: { width: 360, maxWidth: "90vw" } } }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{t("title")}</Typography>
        </Box>
        <Divider />

        {items.length === 0 ? (
          <Box sx={{ px: 2, py: 3, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">{t("empty")}</Typography>
          </Box>
        ) : (
          items.map((n) => {
            const { message, href } = renderNotification(t, n);
            return (
              <MenuItem key={n.id} onClick={() => goTo(href)} sx={{ whiteSpace: "normal", alignItems: "flex-start" }}>
                <Box>
                  <Typography variant="body2">{message}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(n.createdAt).toLocaleString()}
                  </Typography>
                </Box>
              </MenuItem>
            );
          })
        )}

        <Divider />
        <MenuItem component={Link} href="/notifications" onClick={handleClose} sx={{ justifyContent: "center" }}>
          <Typography variant="body2" color="primary">{t("viewAll")}</Typography>
        </MenuItem>
      </Menu>
    </>
  );
}
