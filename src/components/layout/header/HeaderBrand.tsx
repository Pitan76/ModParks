"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { Link } from "@/lib/i18n/routing";

/** ヘッダー左端に常設するロゴ。クリックでトップへ戻る */
const HeaderBrand = () => (
  <Link href="/" prefetch={false} style={{ textDecoration: "none", color: "inherit" }}>
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Box
        component="img"
        src="/icon.svg"
        alt="ModParks Logo"
        sx={{ width: 32, height: 32, borderRadius: "8px", objectFit: "cover" }}
      />
      <Typography
        variant="h6"
        component="span"
        sx={{ fontWeight: 800, letterSpacing: "-0.5px", color: "text.primary" }}
      >
        ModParks
      </Typography>
    </Box>
  </Link>
);

export default HeaderBrand;
