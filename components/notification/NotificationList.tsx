"use client";

import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import { Link } from "@/i18n/routing";
import type { Notification } from "@/db/schema";
import { renderNotification } from "./renderNotification";

interface Props {
  items: Notification[];
}

export default function NotificationList({ items }: Props) {
  const t = useTranslations("Notifications");

  return (
    <List disablePadding sx={{ bgcolor: "background.paper", borderRadius: 1, border: 1, borderColor: "divider" }}>
      {items.map((n, i) => {
        const { message, href } = renderNotification(t, n);
        return (
          <Box key={n.id}>
            {i > 0 && <Divider component="li" />}
            <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
              <ListItemButton sx={{ bgcolor: n.read ? "transparent" : "action.hover" }}>
                <ListItemText primary={message} secondary={new Date(n.createdAt).toLocaleString()} />
              </ListItemButton>
            </Link>
          </Box>
        );
      })}
    </List>
  );
}
