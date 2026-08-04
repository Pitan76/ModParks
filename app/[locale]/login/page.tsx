"use client";

import { useState } from "react";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import GitHubIcon from "@mui/icons-material/GitHub";
import GoogleIcon from "@mui/icons-material/Google";
import PasskeyLoginButton from "@/components/auth/PasskeyLoginButton";
import LastUsedBadge from "@/components/auth/LastUsedBadge";
import { useLastLoginMethod, rememberLoginMethod } from "@/lib/hooks/useLastLoginMethod";
import { Link } from "@/lib/i18n/routing";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";

export default function LoginPage() {
  const tCommon = useTranslations("Common");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const tAuth = useTranslations("Auth");
  const locale = useLocale();
  const lastLoginMethod = useLastLoginMethod();

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
      rememberLoginMethod("credentials");
      router.push(`/${locale}/projects`);
      router.refresh();
    }
  }

  const handleGithubLogin = () => {
    rememberLoginMethod("github");
    signIn("github", { callbackUrl: `/${locale}/projects` });
  };

  const handleGoogleLogin = () => {
    rememberLoginMethod("google");
    signIn("google", { callbackUrl: `/${locale}/projects` });
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
          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 0.5 }}>
            <Link href={`/${locale}/forgot-password`} style={{ textDecoration: "none" }}>
              <Typography variant="body2" color="primary">
                {tAuth("login.forgotPassword")}
              </Typography>
            </Link>
          </Box>

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={loading}
            sx={{ mt: 3, py: 1.2, fontSize: "1rem" }}
          >
            {loading ? tAuth("login.loggingIn") : tAuth("login.title")}
          </Button>

          {lastLoginMethod === "credentials" && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1, textAlign: "center" }}>
              {tAuth("login.lastUsed")}
            </Typography>
          )}
        </form>

        <Divider sx={{ my: 3 }}>
          <Typography variant="body2" color="text.disabled">{tAuth("or")}</Typography>
        </Divider>

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
          <LastUsedBadge active={lastLoginMethod === "github"} sx={{ flex: "1 1 0" }}>
            <Tooltip title={tAuth("login.loginWithGithub")}>
              <Button
                variant="outlined"
                aria-label={tAuth("login.loginWithGithub")}
                onClick={handleGithubLogin}
                sx={{ flex: "1 1 0", minWidth: 0, py: 1.2 }}
              >
                <GitHubIcon />
              </Button>
            </Tooltip>
          </LastUsedBadge>

          <LastUsedBadge active={lastLoginMethod === "google"} sx={{ flex: "1 1 0" }}>
            <Tooltip title={tAuth("login.loginWithGoogle")}>
              <Button
                variant="outlined"
                aria-label={tAuth("login.loginWithGoogle")}
                onClick={handleGoogleLogin}
                sx={{ flex: "1 1 0", minWidth: 0, py: 1.2 }}
              >
                <GoogleIcon />
              </Button>
            </Tooltip>
          </LastUsedBadge>

          <PasskeyLoginButton onError={setError} lastUsed={lastLoginMethod === "passkey"} />
        </Box>

        <Box sx={{ mt: 2, textAlign: "center" }}>
          <Link href={`/${locale}/magic-link`} style={{ textDecoration: "none" }}>
            <Typography variant="body2" color="primary">
              {tAuth("login.loginWithEmail")}
              {lastLoginMethod === "resend" && ` (${tAuth("login.lastUsed")})`}
            </Typography>
          </Link>
        </Box>

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
                {tCommon("cancel") || "Cancel"}
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
