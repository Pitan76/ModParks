"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import OwnedAppsList from "@/components/settings/oauth/OwnedAppsList";
import ConnectedAppsList from "@/components/settings/oauth/ConnectedAppsList";
import OAuthAppDialog from "@/components/settings/oauth/OAuthAppDialog";
import {
  createOAuthApp,
  updateOAuthApp,
  deleteOAuthApp,
  regenerateOAuthAppSecret,
  revokeOAuthConnection,
  type OAuthAppInput,
} from "@/lib/actions/oauthApps";
import type { ConnectedOAuthApp, OwnedOAuthApp } from "@/lib/queries/oauthSettings";

type OAuthAppsTabProps = {
  ownedApps: OwnedOAuthApp[];
  connectedApps: ConnectedOAuthApp[];
};

/**
 * 「他サービスに ModParks 連携を実装する側」と「連携を許可した側」を1画面にまとめる。
 */
export default function OAuthAppsTab({ ownedApps, connectedApps }: OAuthAppsTabProps) {
  const t = useTranslations("Settings");
  const router = useRouter();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OwnedOAuthApp | null>(null);
  const [issuedSecret, setIssuedSecret] = useState("");
  const [error, setError] = useState("");

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(app: OwnedOAuthApp) {
    setEditing(app);
    setDialogOpen(true);
  }

  async function handleSubmit(input: OAuthAppInput) {
    if (editing) {
      const res = await updateOAuthApp(editing.id, input);
      if (!res.success) return setError(t(`oauthApps.errors.${res.error}` as never));
      finishSubmit();
      return;
    }

    const res = await createOAuthApp(input);
    if (!res.success) return setError(t(`oauthApps.errors.${res.error}` as never));
    if (res.clientSecret) setIssuedSecret(res.clientSecret);
    finishSubmit();
  }

  function finishSubmit() {
    setError("");
    setDialogOpen(false);
    router.refresh();
  }

  async function handleRegenerate(clientId: string) {
    const res = await regenerateOAuthAppSecret(clientId);
    if (!res.success) {
      setError(t(`oauthApps.errors.${res.error}` as never));
      return;
    }
    setIssuedSecret(res.clientSecret);
    router.refresh();
  }

  async function handleDelete(clientId: string) {
    await deleteOAuthApp(clientId);
    router.refresh();
  }

  async function handleRevoke(clientId: string) {
    await revokeOAuthConnection(clientId);
    router.refresh();
  }

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{t("oauthApps.description")}</Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {issuedSecret && (
        <Alert severity="warning" sx={{ mb: 3 }} onClose={() => setIssuedSecret("")}>
          <Typography variant="body2">{t("oauthApps.secretOnce")}</Typography>
          <Typography sx={{ fontFamily: "monospace", fontWeight: "bold", wordBreak: "break-all" }}>{issuedSecret}</Typography>
        </Alert>
      )}

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{t("oauthApps.ownedTitle")}</Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate}>{t("oauthApps.newApp")}</Button>
      </Box>
      <OwnedAppsList apps={ownedApps} onEdit={openEdit} onRegenerate={handleRegenerate} onDelete={handleDelete} />

      <Divider sx={{ my: 4 }} />

      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>{t("oauthApps.connectedTitle")}</Typography>
      <ConnectedAppsList apps={connectedApps} onRevoke={handleRevoke} />

      {dialogOpen && (
        <OAuthAppDialog
          open={dialogOpen}
          app={editing}
          onClose={() => setDialogOpen(false)}
          onSubmit={handleSubmit}
        />
      )}
    </Box>
  );
}
