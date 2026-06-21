"use client";

import { useState } from "react";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import { Link } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { requestPasswordReset } from "@/lib/actions/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const tAuth = useTranslations("Auth");
  const locale = useLocale();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("email", email);
      formData.append("locale", locale);

      const res = await requestPasswordReset(formData);
      
      if (res?.error) {
        if (res.error === "TOO_MANY_REQUESTS") setError(tAuth("login.errors.tooManyRequests"));
        else if (res.error === "failedToSendEmail") setError(tAuth("login.errors.failedToSend"));
        else setError(tAuth("login.errors.unexpected"));
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError(tAuth("login.errors.unexpected"));
    } finally {
      setLoading(false);
    }
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
          {tAuth("login.forgotPasswordTitle")}
        </Typography>

        {success ? (
          <Box sx={{ width: "100%", textAlign: "center" }}>
            <Alert severity="success" sx={{ mb: 3 }}>
              {tAuth("login.forgotPasswordSuccess")}
            </Alert>
            <Link href={`/${locale}/login`} style={{ textDecoration: "none" }}>
              <Button variant="outlined" fullWidth>
                {tAuth("login.title")}
              </Button>
            </Link>
          </Box>
        ) : (
          <form onSubmit={handleSubmit} style={{ width: "100%" }}>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {tAuth("login.forgotPasswordDesc")}
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
              disabled={loading}
              sx={{ mt: 3, mb: 2, py: 1.5 }}
            >
              {loading ? tAuth("login.sending") : tAuth("login.sendResetLink")}
            </Button>
            
            <Box sx={{ textAlign: "center" }}>
              <Link href={`/${locale}/login`} style={{ textDecoration: "none" }}>
                <Typography variant="body2" color="primary">
                  {tAuth("login.backToLogin")}
                </Typography>
              </Link>
            </Box>
          </form>
        )}
      </Box>
    </Container>
  );
}
