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
    <Container maxWidth="xs" sx={{ py: 8 }}>
      <Box
        sx={{
          bgcolor: "background.paper",
          p: 4,
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
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
            width: 80,
            height: 80,
            borderRadius: "50%",
            bgcolor: "rgba(37, 99, 235, 0.1)",
            color: "primary.main",
          }}
        >
          <ErrorIcon sx={{ fontSize: 48 }} />
        </Box>

        <Typography variant="h1" sx={{ fontSize: "3rem", fontWeight: 800, color: "primary.main", m: 0 }}>
          404
        </Typography>

        <Typography variant="h5" component="h2" sx={{ fontWeight: 700, m: 0 }}>
          {t("title")}
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 280, mx: "auto" }}>
          {t("description")}
        </Typography>

        <Button
          component={Link}
          href="/"
          variant="contained"
          color="primary"
          fullWidth
          size="large"
          sx={{
            mt: 1,
            py: 1.2,
            fontSize: "1rem",
            textTransform: "none",
          }}
        >
          {t("goBack")}
        </Button>
      </Box>
    </Container>
  );
}
