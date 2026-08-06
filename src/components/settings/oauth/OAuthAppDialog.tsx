"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { OAUTH_SCOPES } from "@/lib/oauth/scopes";
import type { OAuthAppInput } from "@/lib/actions/oauthApps";
import type { OwnedOAuthApp } from "@/lib/queries/oauthSettings";

type OAuthAppDialogProps = {
  open: boolean;
  app: OwnedOAuthApp | null;
  onClose: () => void;
  onSubmit: (input: OAuthAppInput) => void;
};

function toInput(app: OwnedOAuthApp | null): OAuthAppInput {
  return {
    name: app?.name ?? "",
    description: app?.description ?? "",
    homepageUrl: app?.homepageUrl ?? "",
    logoUrl: app?.logoUrl ?? "",
    redirectUris: app?.redirectUris ?? [],
    scopes: app?.scopes ?? [],
    isConfidential: app?.isConfidential ?? true,
  };
}

/**
 * OAuth アプリの新規登録・編集ダイアログ。
 * リダイレクトURIは改行区切りで入力させ、送信時に配列へ直す。
 */
export default function OAuthAppDialog({ open, app, onClose, onSubmit }: OAuthAppDialogProps) {
  const t = useTranslations("Settings");
  const tCommon = useTranslations("Common");
  const initial = toInput(app);

  const [form, setForm] = useState(initial);
  const [redirectText, setRedirectText] = useState(initial.redirectUris.join("\n"));

  function update(patch: Partial<OAuthAppInput>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function toggleScope(scope: string, checked: boolean) {
    update({ scopes: checked ? [...form.scopes, scope] : form.scopes.filter((s) => s !== scope) });
  }

  function handleSubmit() {
    onSubmit({ ...form, redirectUris: redirectText.split("\n").map((s) => s.trim()).filter(Boolean) });
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{app ? t("oauthApps.editApp") : t("oauthApps.newApp")}</DialogTitle>
      <DialogContent>
        <TextField label={t("oauthApps.name")} fullWidth margin="normal" required value={form.name} onChange={(e) => update({ name: e.target.value })} />
        <TextField label={t("oauthApps.descriptionField")} fullWidth margin="normal" multiline minRows={2} value={form.description} onChange={(e) => update({ description: e.target.value })} />
        <TextField label={t("oauthApps.homepageUrl")} fullWidth margin="normal" value={form.homepageUrl} onChange={(e) => update({ homepageUrl: e.target.value })} />
        <TextField label={t("oauthApps.logoUrl")} fullWidth margin="normal" value={form.logoUrl} onChange={(e) => update({ logoUrl: e.target.value })} />
        <TextField
          label={t("oauthApps.redirectUris")}
          helperText={t("oauthApps.redirectUrisHelp")}
          fullWidth
          margin="normal"
          multiline
          minRows={2}
          value={redirectText}
          onChange={(e) => setRedirectText(e.target.value)}
        />

        {!app && (
          <FormControlLabel
            control={<Checkbox checked={form.isConfidential} onChange={(e) => update({ isConfidential: e.target.checked })} />}
            label={t("oauthApps.confidential")}
          />
        )}

        <Typography variant="subtitle2" sx={{ mt: 2 }}>{t("oauthApps.scopes")}</Typography>
        <FormGroup>
          {OAUTH_SCOPES.map((scope) => (
            <FormControlLabel
              key={scope}
              control={<Checkbox checked={form.scopes.includes(scope)} onChange={(e) => toggleScope(scope, e.target.checked)} />}
              label={`${scope} - ${t(`oauthApps.scopeLabels.${scope}` as never)}`}
            />
          ))}
        </FormGroup>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{tCommon("cancel")}</Button>
        <Button variant="contained" onClick={handleSubmit}>{tCommon("save")}</Button>
      </DialogActions>
    </Dialog>
  );
}
