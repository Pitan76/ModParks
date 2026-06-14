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
import { registerUser } from "@/lib/actions/auth";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";

export default function RegisterPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const tAuth = useTranslations("Auth");
  const locale = useLocale();

  const handleGithubLogin = () => {
    signIn("github", { callbackUrl: `/${locale}/projects` });
  };

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");

    if (password.length < 8) {
      setError(tAuth("error.passwordLength"));
      setLoading(false);
      return;
    }

    try {
      const res = await registerUser(formData);
      if (res?.error) {
        setError(res.error ? tAuth(`error.${res.error}`) : tAuth("register.error.registrationFailed"));
        setLoading(false);
      } else {
        router.push("/login?registered=true");
      }
    } catch (err) {
      setError(tAuth("register.error.registrationFailed"));
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

        <form action={handleSubmit}>
          <TextField
            name="username"
            label={tAuth("fields.username")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            fullWidth
            required
            margin="normal"
            helperText={tAuth("fields.usernameHelper")}
          />
          <TextField
            name="displayName"
            label={tAuth("fields.displayName")}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            fullWidth
            required
            margin="normal"
            helperText={tAuth("fields.displayNameHelper")}
          />
          <TextField
            name="email"
            label={tAuth("fields.email")}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            required
            margin="normal"
          />
          <TextField
            name="password"
            label={tAuth("fields.passwordWithRule")}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            required
            margin="normal"
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading}
            sx={{ mt: 4, py: 1.5, fontSize: "1rem" }}
          >
            {loading ? tAuth("register.registering") : tAuth("register.title")}
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
          sx={{ py: 1.2 }}
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
