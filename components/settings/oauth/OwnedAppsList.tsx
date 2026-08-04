"use client";

import { useTranslations } from "next-intl";
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
import type { OwnedOAuthApp } from "@/lib/queries/oauthSettings";

type OwnedAppsListProps = {
  apps: OwnedOAuthApp[];
  onEdit: (app: OwnedOAuthApp) => void;
  onRegenerate: (clientId: string) => void;
  onDelete: (clientId: string) => void;
};

/**
 * 自分が登録した OAuth アプリの一覧。client_id はここでいつでも確認できる。
 */
export default function OwnedAppsList({ apps, onEdit, onRegenerate, onDelete }: OwnedAppsListProps) {
  const t = useTranslations("Settings");
  const tCommon = useTranslations("Common");

  if (apps.length === 0) {
    return <Typography variant="body2" color="text.secondary">{t("oauthApps.noApps")}</Typography>;
  }

  return (
    <List disablePadding>
      {apps.map((app) => (
        <ListItem key={app.id} divider alignItems="flex-start" sx={{ flexWrap: "wrap", gap: 1 }}>
          <ListItemAvatar>
            <Avatar src={app.logoUrl ?? undefined}><ExtensionIcon /></Avatar>
          </ListItemAvatar>
          <ListItemText
            primary={app.name}
            secondaryTypographyProps={{ component: "div" }}
            secondary={
              <Box>
                <Typography variant="caption" sx={{ fontFamily: "monospace", display: "block" }}>{app.id}</Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
                  {app.scopes.map((scope) => <Chip key={scope} label={scope} size="small" variant="outlined" />)}
                  {!app.isConfidential && <Chip label={t("oauthApps.publicClient")} size="small" color="info" />}
                </Box>
              </Box>
            }
          />
          <Box sx={{ display: "flex", gap: 1, ml: "auto" }}>
            <Button size="small" onClick={() => onEdit(app)}>{tCommon("edit")}</Button>
            {app.isConfidential && (
              <Button size="small" onClick={() => onRegenerate(app.id)}>{t("oauthApps.regenerate")}</Button>
            )}
            <Button size="small" color="error" onClick={() => onDelete(app.id)}>{tCommon("delete")}</Button>
          </Box>
        </ListItem>
      ))}
    </List>
  );
}
