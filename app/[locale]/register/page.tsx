"use client";

import { useState } from "react";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import GitHubIcon from "@mui/icons-material/GitHub";
import { Link } from "@/i18n/routing";
import { sendRegistrationEmail } from "@/lib/actions/auth";
import { signIn } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";

export default function RegisterPage() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const tAuth = useTranslations("Auth");
  const locale = useLocale();

  const handleGithubLogin = () => {
    signIn("github", { callbackUrl: `/${locale}/projects` });
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    if (!email) {
      setError(tAuth("error.allFieldsRequired"));
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("email", email);
      formData.append("locale", locale);

      const res = await sendRegistrationEmail(formData);
      if (res?.error) {
        setError(res.error ? tAuth(`error.${res.error}`) : tAuth("register.error.registrationFailed"));
      } else {
        setSuccess(true);
        setEmail(""); // Clear email
      }
    } catch (err) {
      setError(tAuth("register.error.registrationFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container maxWidth="xs" sx={{ py: 8 }}>
      <Box
        sx={{
          bgcolor: "background.paper",
          p: 4,
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mb: 1 }} align="center" color="primary.main">
          {tAuth("register.title")}
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 4 }}>
          {tAuth("register.welcome")}
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 3 }}>{tAuth("register.checkYourEmail") || "Verification email sent. Please check your inbox."}</Alert>}

        {!success && (
          <form onSubmit={handleSubmit}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {tAuth("register.emailDesc") || "Enter your email to verify and complete registration."}
            </Typography>
            
            <TextField
              name="email"
              label={tAuth("fields.email")}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
              margin="normal"
              disabled={loading}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading || !email}
              sx={{ mt: 2, py: 1.5, fontSize: "1rem" }}
            >
              {loading ? tAuth("register.sending") || "Sending..." : tAuth("register.sendVerificationEmail") || "Send Verification Email"}
            </Button>
          </form>
        )}

        <Divider sx={{ my: 3 }}>
          <Typography variant="body2" color="text.disabled">{tAuth("or")}</Typography>
        </Divider>

        <Button
          variant="outlined"
          fullWidth
          size="large"
          startIcon={<GitHubIcon />}
          onClick={handleGithubLogin}
          sx={{ py: 1.2, mb: 2 }}
        >
          {tAuth("register.registerWithGithub")}
        </Button>

        <Box sx={{ mt: 4, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary">
            {tAuth("register.alreadyHaveAccount")}{" "}
            <Link href="/login" style={{ color: "#38bdf8", textDecoration: "none" }}>
              {tAuth("register.loginLink")}
            </Link>
          </Typography>
        </Box>
      </Box>
    </Container>
  );
}
