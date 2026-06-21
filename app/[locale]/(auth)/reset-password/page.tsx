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
  

  const locale = useLocale();
  const isEn = locale === "en";

  useEffect(() => {
    if (!token) {
      setError(isEn ? "Invalid or missing token." : "無効なトークンです。");
    }
  }, [token, isEn]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;

    if (password !== confirmPassword) {
      setError(isEn ? "Passwords do not match." : "パスワードが一致しません。");
      return;
    }

    if (password.length < 8) {
      setError(isEn ? "Password must be at least 8 characters long." : "パスワードは8文字以上である必要があります。");
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
        if (res.error === "TOO_MANY_REQUESTS") setError(isEn ? "Too many requests. Please try again later." : "リクエストが多すぎます。しばらく経ってからお試しください。");
        else if (res.error === "invalidToken") setError(isEn ? "Invalid token." : "無効なトークンです。");
        else if (res.error === "tokenExpired") setError(isEn ? "Token has expired. Please request a new link." : "トークンの有効期限が切れています。再度リセットリンクを発行してください。");
        else setError(isEn ? "An unexpected error occurred." : "予期せぬエラーが発生しました。");
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError(isEn ? "An unexpected error occurred." : "予期せぬエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <Box sx={{ width: "100%", textAlign: "center" }}>
        <Alert severity="success" sx={{ mb: 3 }}>
          {isEn ? "Password has been reset successfully." : "パスワードが正常に再設定されました。"}
        </Alert>
        <Link href={`/${locale}/login`} style={{ textDecoration: "none" }}>
          <Button variant="contained" fullWidth size="large">
            {isEn ? "Go to Login" : "ログイン画面へ"}
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
        label={isEn ? "New Password" : "新しいパスワード"}
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
        label={isEn ? "Confirm New Password" : "新しいパスワード（確認）"}
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
        {loading ? (isEn ? "Resetting..." : "再設定中...") : (isEn ? "Reset Password" : "パスワードを再設定する")}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  const locale = useLocale();
  const isEn = locale === "en";

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
          {isEn ? "Reset Password" : "パスワードの再設定"}
        </Typography>
        
        <Suspense fallback={<Typography>Loading...</Typography>}>
          <ResetPasswordForm />
        </Suspense>
      </Box>
    </Container>
  );
}
