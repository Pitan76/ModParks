"use client";

import { useTranslations, useFormatter } from "next-intl";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import ExtensionIcon from "@mui/icons-material/Extension";
import type { ConnectedOAuthApp } from "@/lib/queries/oauthSettings";

type ConnectedAppsListProps = {
  apps: ConnectedOAuthApp[];
  onRevoke: (clientId: string) => void;
};

/**
 * 自分のアカウントへアクセスを許可しているアプリの一覧。
 */
export default function ConnectedAppsList({ apps, onRevoke }: ConnectedAppsListProps) {
  const t = useTranslations("Settings");
  const format = useFormatter();

  if (apps.length === 0) {
    return <Typography variant="body2" color="text.secondary">{t("oauthApps.noConnections")}</Typography>;
  }

  return (
    <List disablePadding>
      {apps.map((app) => (
        <ListItem
          key={app.clientId}
          divider
          secondaryAction={
            <Button color="error" size="small" onClick={() => onRevoke(app.clientId)}>
              {t("oauthApps.revoke")}
            </Button>
          }
        >
          <ListItemAvatar>
            <Avatar src={app.logoUrl ?? undefined}><ExtensionIcon /></Avatar>
          </ListItemAvatar>
          <ListItemText
            primary={app.name}
            secondaryTypographyProps={{ component: "div" }}
            secondary={
              <Box>
                <Typography variant="caption" color="text.secondary" component="div">
                  {t("oauthApps.authorizedAt", { date: format.dateTime(new Date(app.authorizedAt), { dateStyle: "short" }) })}
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
                  {app.scopes.map((scope) => (
                    <Chip key={scope} label={scope} size="small" variant="outlined" />
                  ))}
                </Box>
              </Box>
            }
          />
        </ListItem>
      ))}
    </List>
  );
}
