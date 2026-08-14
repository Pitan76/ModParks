"use client";

import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { Link } from "@/lib/i18n/routing";
import { useTranslations } from "next-intl";
import ErrorIcon from "@mui/icons-material/Error";

/**
 * 404 Not Found ページ。
 * 存在しないページにアクセスされた際に表示する。
 */
export default function NotFound() {
  const t = useTranslations("NotFound");

  return (
    <Container maxWidth="sm" sx={{ py: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 3,
        }}
      >
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 120,
            height: 120,
            borderRadius: "50%",
            bgcolor: "rgba(37, 99, 235, 0.1)",
            color: "primary.main",
            mb: 2,
            animation: "pulse 2s infinite ease-in-out",
            "@keyframes pulse": {
              "0%": { transform: "scale(0.95)", boxShadow: "0 0 0 0 rgba(37, 99, 235, 0.4)" },
              "70%": { transform: "scale(1)", boxShadow: "0 0 0 15px rgba(37, 99, 235, 0)" },
              "100%": { transform: "scale(0.95)", boxShadow: "0 0 0 0 rgba(37, 99, 235, 0)" },
            },
          }}
        >
          <ErrorIcon sx={{ fontSize: 64 }} />
        </Box>

        <Typography variant="h1" sx={{ fontSize: { xs: "5rem", sm: "6rem" }, fontWeight: 900, color: "primary.main", lineHeight: 1, letterSpacing: -2 }}>
          404
        </Typography>

        <Typography variant="h4" component="h2" sx={{ fontWeight: 700 }}>
          {t("title")}
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 400, mx: "auto" }}>
          {t("description")}
        </Typography>

        <Button
          component={Link}
          href="/"
          variant="contained"
          color="primary"
          size="large"
          sx={{
            mt: 2,
            px: 4,
            py: 1.5,
            borderRadius: 8,
            fontWeight: "bold",
            textTransform: "none",
            boxShadow: "0 4px 14px 0 rgba(37, 99, 235, 0.4)",
            "&:hover": {
              boxShadow: "0 6px 20px 0 rgba(37, 99, 235, 0.6)",
            },
          }}
        >
          {t("goBack")}
        </Button>
      </Box>
    </Container>
  );
}
