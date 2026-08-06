"use client";

import { useState } from "react";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import { Link } from "@/lib/i18n/routing";
import { signIn } from "next-auth/react";
import { rememberLoginMethod } from "@/lib/hooks/useLastLoginMethod";
import { useTranslations, useLocale } from "next-intl";

/**
 * マジックリンク（Resend プロバイダ）でのログイン専用ページ。
 * ログイン画面にメール入力欄が二つ並ぶのを避けるため、独立したページに切り出している。
 */
export default function MagicLinkPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const tAuth = useTranslations("Auth");
  const locale = useLocale();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    rememberLoginMethod("resend");
    signIn("resend", { email, callbackUrl: `/${locale}/projects` });
  }

  return (
    <Container maxWidth="xs" sx={{ py: 8 }}>
      <Box sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        backgroundColor: "background.paper",
        p: 4,
        borderRadius: 2,
        boxShadow: 1
      }}>
        <Typography component="h1" variant="h5" sx={{ mb: 3, fontWeight: "bold" }}>
          {tAuth("login.loginWithEmail")}
        </Typography>

        <form onSubmit={handleSubmit} style={{ width: "100%" }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {tAuth("login.magicLinkDesc")}
          </Typography>

          <TextField
            name="email"
            label={tAuth("fields.email")}
            type="email"
            fullWidth
            required
            margin="normal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={loading || !email}
            sx={{ mt: 3, mb: 2, py: 1.2 }}
          >
            {loading ? tAuth("login.sending") : tAuth("login.sendMagicLink")}
          </Button>

          <Box sx={{ textAlign: "center" }}>
            <Link href={`/${locale}/login`} style={{ textDecoration: "none" }}>
              <Typography variant="body2" color="primary">
                {tAuth("login.backToLogin")}
              </Typography>
            </Link>
          </Box>
        </form>
      </Box>
    </Container>
  );
}
