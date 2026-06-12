"use client";

import { useState, useEffect } from "react";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import GitHubIcon from "@mui/icons-material/GitHub";
import { Link } from "@/i18n/routing";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const registered = searchParams.get("registered");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("メールアドレスまたはパスワードが間違っています。");
      setLoading(false);
    } else {
      router.push("/ja/projects");
      router.refresh();
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
        <Typography variant="h4" component="h1" fontWeight={800} align="center" mb={1} color="primary.main">
          ログイン
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center" mb={4}>
          お帰りなさい！
        </Typography>

        {registered && <Alert severity="success" sx={{ mb: 3 }}>登録が完了しました。ログインしてください。</Alert>}
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        <form onSubmit={handleSubmit}>
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
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading}
            sx={{ mt: 3, py: 1.5, fontSize: "1rem" }}
          >
            {loading ? "ログイン中..." : "ログイン"}
          </Button>
        </form>

        <Divider sx={{ my: 3 }}>
          <Typography variant="body2" color="text.disabled">または</Typography>
        </Divider>

        <Button
          variant="outlined"
          fullWidth
          startIcon={<GitHubIcon />}
          onClick={() => signIn("github", { callbackUrl: "/ja/projects" })}
          sx={{ py: 1.2 }}
        >
          GitHub でログイン
        </Button>

        <Box sx={{ mt: 4, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary">
            アカウントをお持ちでないですか？{" "}
            <Link href="/register" style={{ color: "#38bdf8", textDecoration: "none" }}>
              新規登録はこちら
            </Link>
          </Typography>
        </Box>
      </Box>
    </Container>
  );
}
