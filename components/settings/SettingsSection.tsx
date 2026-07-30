import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

/** 設定の各セクションの見出し。ルートごとに同じ体裁を保つために共通化する */
export default function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Box>
      <Typography
        variant="h4"
        sx={{ mb: 4, fontWeight: 800, fontSize: { xs: "1.6rem", sm: "2.125rem" } }}
      >
        {title}
      </Typography>
      {children}
    </Box>
  );
}
