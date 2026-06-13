"use client";

import { useState } from "react";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import { Link } from "@/i18n/routing";
import { registerUser } from "@/lib/actions/auth";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");

    const res = await registerUser(formData);
    if (res?.error) {
      setError(res.error);
      setLoading(false);
    } else {
      router.push("/ja/login?registered=true");
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
          新規登録
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 4 }}>
          ModParks へようこそ！
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        <form action={handleSubmit}>
          <TextField
            name="username"
            label="ユーザーネーム (ID)"
            fullWidth
            required
            margin="normal"
            placeholder="例: example_dev"
            helperText="ログインIDやURLの一部として使用されます（英数字）"
          />
          <TextField
            name="displayName"
            label="表示名"
            fullWidth
            required
            margin="normal"
            placeholder="例: Example Developer"
            helperText="サイト上に表示される名前です"
          />
          <TextField
            name="email"
            label="メールアドレス"
            type="email"
            fullWidth
            required
            margin="normal"
          />
          <TextField
            name="password"
            label="パスワード"
            type="password"
            fullWidth
            required
            margin="normal"
            helperText="8文字以上で入力してください"
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading}
            sx={{ mt: 4, py: 1.5, fontSize: "1rem" }}
          >
            {loading ? "登録中..." : "アカウントを登録"}
          </Button>
        </form>

        <Box sx={{ mt: 3, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary">
            すでにアカウントをお持ちですか？{" "}
            <Link href="/login" style={{ color: "#38bdf8", textDecoration: "none" }}>
              ログインはこちら
            </Link>
          </Typography>
        </Box>
      </Box>
    </Container>
  );
}
