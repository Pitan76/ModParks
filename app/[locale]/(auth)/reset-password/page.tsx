"use client";

import { useState, useEffect, Suspense } from "react";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import { Link } from "@/i18n/routing";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { resetPasswordWithToken } from "@/lib/actions/auth";

function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  
  const searchParams = useSearchParams();
  const token = searchParams?.get("token");
  
  const tAuth = useTranslations("Auth");
  const locale = useLocale();

  useEffect(() => {
    if (!token) {
      setError(tAuth("login.errors.invalidToken"));
    }
  }, [token, tAuth]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;

    if (password !== confirmPassword) {
      setError(tAuth("login.errors.passwordsMismatch"));
      return;
    }

    if (password.length < 8) {
      setError(tAuth("login.errors.passwordTooShort"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("token", token);
      formData.append("password", password);

      const res = await resetPasswordWithToken(formData);
      
      if (res?.error) {
        if (res.error === "TOO_MANY_REQUESTS") setError(tAuth("login.errors.tooManyRequests"));
        else if (res.error === "invalidToken") setError(tAuth("login.errors.invalidToken"));
        else if (res.error === "tokenExpired") setError(tAuth("login.errors.tokenExpired"));
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

  if (success) {
    return (
      <Box sx={{ width: "100%", textAlign: "center" }}>
        <Alert severity="success" sx={{ mb: 3 }}>
          {tAuth("login.resetSuccess")}
        </Alert>
        <Link href={`/${locale}/login`} style={{ textDecoration: "none" }}>
          <Button variant="contained" fullWidth size="large">
            {tAuth("login.goToLogin")}
          </Button>
        </Link>
      </Box>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ width: "100%" }}>
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      
      <TextField
        name="password"
        label={tAuth("login.newPassword")}
        type="password"
        fullWidth
        required
        margin="normal"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={loading || !token}
      />

      <TextField
        name="confirmPassword"
        label={tAuth("login.confirmNewPassword")}
        type="password"
        fullWidth
        required
        margin="normal"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        disabled={loading || !token}
      />

      <Button
        type="submit"
        variant="contained"
        fullWidth
        size="large"
        disabled={loading || !token}
        sx={{ mt: 3, mb: 2, py: 1.5 }}
      >
        {loading ? tAuth("login.resetting") : tAuth("login.resetPasswordBtn")}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  const tAuth = useTranslations("Auth");

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
          {tAuth("login.resetPasswordTitle")}
        </Typography>
        
        <Suspense fallback={<Typography>Loading...</Typography>}>
          <ResetPasswordForm />
        </Suspense>
      </Box>
    </Container>
  );
}
