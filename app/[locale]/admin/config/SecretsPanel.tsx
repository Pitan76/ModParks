"use client";

import { useState, useTransition } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { useTranslations } from "next-intl";
import { setSecret, removeSecret, type SecretEntry } from "@/lib/actions/workerSecrets";

type Pending = { mode: "set"; name: string } | { mode: "delete"; name: string } | null;

export default function SecretsPanel({
  initialSecrets,
  loadError,
}: {
  initialSecrets: SecretEntry[];
  loadError?: string;
}) {
  const t = useTranslations("Admin.config");
  const [pending, setPending] = useState<Pending>(null);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [totp, setTotp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const closeDialog = () => {
    setPending(null);
    setName("");
    setValue("");
    setTotp("");
    setError(null);
  };

  const handleConfirm = () => {
    if (!pending) return;
    setError(null);
    startTransition(async () => {
      const result =
        pending.mode === "delete"
          ? await removeSecret(pending.name, totp)
          : await setSecret(pending.name || name, value, totp);

      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSuccess(pending.mode === "delete" ? t("secretDeleted") : t("secretSaved"));
      closeDialog();
    });
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 1 }}>{t("secrets")}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("secretsDesc")}
        </Typography>

        {loadError && <Alert severity="warning" sx={{ mb: 2 }}>{loadError}</Alert>}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>
        )}

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setPending({ mode: "set", name: "" })}
          sx={{ mb: 2 }}
        >
          {t("addSecret")}
        </Button>

        <List>
          {initialSecrets.map((s) => (
            <ListItem
              key={s.name}
              divider
              secondaryAction={
                <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                  <Button size="small" onClick={() => setPending({ mode: "set", name: s.name })}>
                    {t("overwrite")}
                  </Button>
                  <IconButton
                    edge="end"
                    disabled={!s.editable}
                    onClick={() => setPending({ mode: "delete", name: s.name })}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              }
            >
              <ListItemText
                primary={s.name}
                secondary={s.editable ? undefined : t("secretProtected")}
              />
            </ListItem>
          ))}
          {initialSecrets.length === 0 && !loadError && (
            <Typography variant="body2" color="text.secondary">{t("noSecrets")}</Typography>
          )}
        </List>

        <Dialog open={pending !== null} onClose={closeDialog} fullWidth maxWidth="sm">
          <DialogTitle>
            {pending?.mode === "delete" ? t("deleteSecretTitle") : t("setSecretTitle")}
          </DialogTitle>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {pending?.mode === "delete" ? (
              <Typography sx={{ mb: 2 }}>
                {t("deleteSecretConfirm")} <Chip label={pending.name} size="small" />
              </Typography>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
                <TextField
                  label={t("secretName")}
                  value={pending?.name || name}
                  disabled={Boolean(pending?.name)}
                  onChange={(e) => setName(e.target.value)}
                  helperText={t("secretNameHelp")}
                  fullWidth
                />
                <TextField
                  label={t("secretValue")}
                  type="password"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  autoComplete="new-password"
                  helperText={t("secretValueHelp")}
                  fullWidth
                />
              </Box>
            )}

            <TextField
              label={t("totpCode")}
              value={totp}
              onChange={(e) => setTotp(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              helperText={t("totpHelp")}
              fullWidth
              sx={{ mt: 2 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog}>{t("cancel")}</Button>
            <Button
              variant="contained"
              color={pending?.mode === "delete" ? "error" : "primary"}
              onClick={handleConfirm}
              disabled={isPending || !totp}
            >
              {pending?.mode === "delete" ? t("delete") : t("save")}
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
}
