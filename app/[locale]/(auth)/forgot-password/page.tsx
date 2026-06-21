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

  const isEn = locale === "en";

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
        if (res.error === "TOO_MANY_REQUESTS") setError(isEn ? "Too many requests. Please try again later." : "リクエストが多すぎます。しばらく経ってからお試しください。");
        else if (res.error === "failedToSendEmail") setError(isEn ? "Failed to send email." : "メールの送信に失敗しました。");
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

        {success ? (
          <Box sx={{ width: "100%", textAlign: "center" }}>
            <Alert severity="success" sx={{ mb: 3 }}>
              {isEn ? "If the email exists, a password reset link has been sent." : "メールアドレスが登録されている場合、パスワード再設定リンクを送信しました。"}
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
              {isEn ? "Enter your email address and we will send you a link to reset your password." : "登録しているメールアドレスを入力してください。パスワード再設定用のリンクを送信します。"}
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
              {loading ? (isEn ? "Sending..." : "送信中...") : (isEn ? "Send Reset Link" : "再設定リンクを送信")}
            </Button>
            
            <Box sx={{ textAlign: "center" }}>
              <Link href={`/${locale}/login`} style={{ textDecoration: "none" }}>
                <Typography variant="body2" color="primary">
                  {isEn ? "Back to Login" : "ログイン画面に戻る"}
                </Typography>
              </Link>
            </Box>
          </form>
        )}
      </Box>
    </Container>
  );
}
