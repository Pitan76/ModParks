"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { startRegistration } from "@simplewebauthn/browser";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import IconButton from "@mui/material/IconButton";
import DeleteIcon from "@mui/icons-material/Delete";
import { useFlashMessage } from "@/lib/hooks/useFlashMessage";
import { startPasskeyRegistration, finishPasskeyRegistration, deletePasskey, type PasskeyInfo } from "@/lib/actions/passkey";
import PasskeyNameDialog from "./PasskeyNameDialog";

interface Props {
  initialPasskeys: PasskeyInfo[];
}

export default function PasskeyManager({ initialPasskeys }: Props) {
  const t = useTranslations("Settings");
  const { message, flash } = useFlashMessage();
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>(initialPasskeys);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const handleRegister = async (name: string) => {
    setNameDialogOpen(false);
    setPending(true);
    try {
      const options = await startPasskeyRegistration();
      const response = await startRegistration(options);
      const res = await finishPasskeyRegistration(response, name);
      if ("error" in res) {
        flash("error", t("security.passkeyRegisterError"));
        return;
      }
      setPasskeys((prev) => [...prev, { credentialID: response.id, name: name || null, createdAt: new Date() }]);
      flash("success", t("security.passkeyRegistered"));
    } catch {
      flash("error", t("security.passkeyRegisterError"));
    } finally {
      setPending(false);
    }
  };

  const handleDelete = async (credentialID: string) => {
    setPending(true);
    await deletePasskey(credentialID);
    setPasskeys((prev) => prev.filter((p) => p.credentialID !== credentialID));
    setPending(false);
    flash("success", t("security.passkeyDeleted"));
  };

  return (
    <Box sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 2, mb: 2 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>{t("security.passkeys")}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t("security.passkeysDesc")}</Typography>

      {message && <Typography variant="body2" color={message.type === "error" ? "error.main" : "success.main"} sx={{ mb: 2 }}>{message.text}</Typography>}

      {passkeys.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: "italic" }}>{t("security.noPasskeys")}</Typography>
      ) : (
        <List dense sx={{ mb: 2 }}>
          {passkeys.map((pk) => (
            <ListItem
              key={pk.credentialID}
              secondaryAction={
                <IconButton edge="end" color="error" disabled={pending} onClick={() => handleDelete(pk.credentialID)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              }
            >
              <ListItemText
                primary={pk.name || t("security.passkeyUnnamed")}
                secondary={pk.createdAt ? new Date(pk.createdAt).toLocaleDateString() : undefined}
              />
            </ListItem>
          ))}
        </List>
      )}

      <Button variant="outlined" disabled={pending} onClick={() => setNameDialogOpen(true)}>{t("security.registerPasskey")}</Button>

      <PasskeyNameDialog open={nameDialogOpen} onClose={() => setNameDialogOpen(false)} onConfirm={handleRegister} />
    </Box>
  );
}
