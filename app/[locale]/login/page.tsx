"use client";

import { useState, useEffect } from "react";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import GitHubIcon from "@mui/icons-material/GitHub";
import { Link } from "@/i18n/routing";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const tAuth = useTranslations("Auth");
  const locale = useLocale();

  const [token, setToken] = useState("");
  const [showTwoFactor, setShowTwoFactor] = useState(false);

  const registered = searchParams?.get("registered") === "true";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // 1. If 2FA dialog is not open yet, we must check if the user has 2FA enabled
    if (!showTwoFactor) {
      try {
        const checkRes = await fetch("/api/auth/check-2fa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        
        if (checkRes.ok) {
          const body = (await checkRes.json()) as { twoFactorEnabled?: boolean };
          if (body.twoFactorEnabled) {
            // User has 2FA enabled, open the dialog and wait for token
            setShowTwoFactor(true);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to check 2FA status:", err);
      }
    }

    // 2. Actually perform the login (with or without token)
    const res = await signIn("credentials", {
      email,
      password,
      token: showTwoFactor ? token : undefined,
      redirect: false,
    });

    if (res?.error) {
      if (res.error.includes("2FA_REQUIRED") || res.error === "TwoFactorRequiredError" || res.error === "b4") {
        setShowTwoFactor(true);
        setError("");
      } else if (res.error.includes("INVALID_2FA_TOKEN") || res.error === "InvalidTwoFactorError") {
        setError(tAuth("login.error.invalidTwoFactor"));
      } else {
        setError(tAuth("login.error.invalidCredentials"));
      }
      setLoading(false);
    } else {
      router.push(`/${locale}/projects`);
      router.refresh();
    }
  }

  const handleGithubLogin = () => {
    signIn("github", { callbackUrl: `/${locale}/projects` });
  };

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
          {tAuth("login.title")}
        </Typography>

        {registered && <Alert severity="success" sx={{ mb: 3 }}>{tAuth("login.registrationComplete")}</Alert>}
        {error && !showTwoFactor && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        <form onSubmit={handleSubmit}>
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
          <TextField
            name="password"
            label={tAuth("fields.password")}
            type="password"
            fullWidth
            required
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={loading}
            sx={{ mt: 3, py: 1.5, fontSize: "1rem" }}
          >
            {loading ? tAuth("login.loggingIn") : tAuth("login.title")}
          </Button>
        </form>

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
          {tAuth("login.loginWithGithub")}
        </Button>

        <form onSubmit={(e) => {
          e.preventDefault();
          setLoading(true);
          signIn("resend", { email, callbackUrl: `/${locale}/projects` });
        }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1, mt: 1 }}>
            {tAuth("login.loginWithEmail") || "Log in with Magic Link"}
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <TextField
              name="magicEmail"
              label={tAuth("fields.email")}
              type="email"
              size="small"
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
            <Button
              type="submit"
              variant="outlined"
              disabled={loading || !email}
              sx={{ whiteSpace: "nowrap" }}
            >
              {tAuth("login.sendLink") || "Send Link"}
            </Button>
          </Box>
        </form>

        <Box sx={{ mt: 4, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary">
            {tAuth("login.noAccount")}{" "}
            <Link href="/register" style={{ color: "#38bdf8", textDecoration: "none" }}>
              {tAuth("login.registerLink")}
            </Link>
          </Typography>
        </Box>

        <Dialog open={showTwoFactor} onClose={() => setShowTwoFactor(false)} maxWidth="xs" fullWidth>
          <form onSubmit={handleSubmit}>
            <DialogTitle>{tAuth("login.twoFactorRequired") || "Two-Factor Authentication"}</DialogTitle>
            <DialogContent>
              <DialogContentText sx={{ mb: 2 }}>
                {tAuth("login.twoFactorDesc") || "Please enter the verification code generated by your authenticator app."}
              </DialogContentText>
              {error && error.includes("2FA") && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              <TextField
                autoFocus
                margin="dense"
                name="token"
                label={tAuth("fields.twoFactorToken") || "2FA Token"}
                type="text"
                fullWidth
                variant="outlined"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={loading}
              />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3 }}>
              <Button onClick={() => setShowTwoFactor(false)} disabled={loading} color="inherit">
                {tAuth("login.cancel") || "Cancel"}
              </Button>
              <Button type="submit" disabled={loading || !token}>
                {tAuth("login.verify") || "Verify"}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </Box>
    </Container>
  );
}
