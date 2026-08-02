"use client";

import Box from "@mui/material/Box";
import { useTranslations } from "next-intl";
import LinkButton from "@/components/ui/LinkButton";

/** 未ログイン時に出すログイン／新規登録ボタン */
const AuthButtons = () => {
  const t = useTranslations("Nav");

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <LinkButton
        id="login-button"
        href="/login"
        variant="outlined"
        size="small"
        sx={{
          borderColor: "primary.main",
          color:        "primary.main",
          "&:hover": {
            background:  "rgba(56,189,248,0.08)",
            borderColor: "primary.light",
          },
        }}
      >
        <Box component="span" sx={{ mt: "1px" }}>{t("login")}</Box>
      </LinkButton>
      <LinkButton id="register-button" href="/register" variant="contained" size="small">
        <Box component="span" sx={{ mt: "1px" }}>{t("register")}</Box>
      </LinkButton>
    </Box>
  );
};

export default AuthButtons;
