"use client";

import { useState, Suspense } from "react";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import { registerUser } from "@/lib/actions/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

function RegisterCompleteForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const tAuth = useTranslations("Auth");
  
  const token = searchParams?.get("token");
  const email = searchParams?.get("email");

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

  if (!token || !email) {
    return (
      <Alert severity="error">
        {tAuth("register.invalidToken") || "Invalid or missing token. Please register again."}
      </Alert>
    );
  }

  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        p: 4,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Typography variant="h5" component="h1" sx={{ fontWeight: 800, mb: 1 }} align="center" color="primary.main">
        {tAuth("register.completeRegistration") || "Complete Registration"}
      </Typography>
      <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 4 }}>
        {email}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <form action={handleSubmit}>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="email" value={email} />

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
          {loading ? tAuth("register.registering") : (tAuth("register.completeRegistration") || "Complete Registration")}
        </Button>
      </form>
    </Box>
  );
}

export default function RegisterCompletePage() {
  return (
    <Container maxWidth="xs" sx={{ py: 8 }}>
      <Suspense fallback={<Typography>Loading...</Typography>}>
        <RegisterCompleteForm />
      </Suspense>
    </Container>
  );
}
