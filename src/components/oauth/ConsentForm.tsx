"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Avatar from "@mui/material/Avatar";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import ExtensionIcon from "@mui/icons-material/Extension";
import { approveAuthorization, denyAuthorization } from "@/lib/actions/oauthConsent";

export type ConsentClient = {
  name: string;
  description: string | null;
  logoUrl: string | null;
  homepageUrl: string | null;
  isTrusted: boolean;
};

type ConsentFormProps = {
  rawQuery: string;
  scopes: string[];
  accountName: string;
  client: ConsentClient;
};

export default function ConsentForm({ rawQuery, scopes, accountName, client }: ConsentFormProps) {
  const t = useTranslations("OAuth");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function run(action: typeof approveAuthorization) {
    setPending(true);
    setError("");
    const res = await action(rawQuery);
    if (!res.success) {
      setError(t("consent.failed"));
      setPending(false);
      return;
    }
    window.location.assign(res.redirectTo);
  }

  return (
    <Box sx={{ bgcolor: "background.paper", p: 4, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
        <Avatar src={client.logoUrl ?? undefined} sx={{ width: 56, height: 56 }}>
          <ExtensionIcon />
        </Avatar>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{client.name}</Typography>
          {client.homepageUrl && (
            <Typography variant="body2" color="text.secondary" component="a" href={client.homepageUrl} target="_blank" rel="noopener noreferrer">
              {client.homepageUrl}
            </Typography>
          )}
        </Box>
      </Box>

      <Typography variant="body1" sx={{ mb: 1 }}>{t("consent.title", { app: client.name })}</Typography>
      {client.description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{client.description}</Typography>
      )}

      {!client.isTrusted && <Alert severity="warning" sx={{ mb: 2 }}>{t("consent.untrusted")}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" sx={{ mb: 1 }}>{t("consent.permissions")}</Typography>

      <List dense disablePadding>
        {scopes.map((scope) => (
          <ListItem key={scope} disableGutters>
            <ListItemIcon sx={{ minWidth: 32 }}><CheckCircleOutlinedIcon fontSize="small" color="success" /></ListItemIcon>
            <ListItemText primary={t(`scopes.${scope}` as never)} />
          </ListItem>
        ))}
      </List>

      <Divider sx={{ my: 2 }} />
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 3 }}>
        {t("consent.account", { account: accountName })}
      </Typography>

      <Box sx={{ display: "flex", gap: 1.5 }}>
        <Button variant="outlined" fullWidth disabled={pending} onClick={() => run(denyAuthorization)}>
          {t("consent.deny")}
        </Button>
        <Button variant="contained" fullWidth disabled={pending} onClick={() => run(approveAuthorization)}>
          {t("consent.approve")}
        </Button>
      </Box>
    </Box>
  );
}
