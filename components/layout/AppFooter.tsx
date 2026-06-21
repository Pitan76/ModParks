"use client";

import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import GitHubIcon from "@mui/icons-material/GitHub";
import RssFeedIcon from "@mui/icons-material/RssFeed";
import { Link as NextLink } from "@/i18n/routing";

export default function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <Box
      component="footer"
      id="app-footer"
      sx={{
        mt:         "auto",
        py:         4,
        bgcolor:    "background.paper",
        borderTop:  "1px solid",
        borderColor: "divider",
      }}
    >
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{
            justifyContent: "space-between",
            alignItems: { xs: "center", md: "flex-start" },
          }}
        >
          {/* ブランド */}
          <Box>
            <Typography
              variant="h6"
              sx={{ fontWeight: 800, color: "primary.main", mb: 0.5 }}
            >
              ModParks
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Minecraft Java Edition向けMod/Pluginプラットフォーム
            </Typography>
          </Box>

          {/* リンク */}
          <Stack direction="row" spacing={3} sx={{ alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
            <Link
              component={NextLink}
              href="/terms"
              prefetch={false}
              sx={{ color: "text.secondary", fontSize: "0.875rem" }}
            >
              利用規約
            </Link>
            <Link
              component={NextLink}
              href="/privacy"
              prefetch={false}
              sx={{ color: "text.secondary", fontSize: "0.875rem" }}
            >
              プライバシーポリシー
            </Link>
            <Link
              href="/feed.xml"
              target="_blank"
              rel="noopener noreferrer"
              id="footer-rss"
              sx={{ color: "text.secondary", display: "flex", alignItems: "center", gap: 0.5 }}
            >
              <RssFeedIcon fontSize="small" />
              RSS
            </Link>
            <Link
              href="https://github.com/Pitan76/modparks"
              target="_blank"
              rel="noopener noreferrer"
              id="footer-github"
              sx={{ color: "text.secondary", display: "flex", alignItems: "center", gap: 0.5 }}
            >
              <GitHubIcon fontSize="small" />
              GitHub
            </Link>
          </Stack>
        </Stack>

        <Divider sx={{ my: 3 }} />

        <Typography variant="caption" color="text.disabled" align="center" sx={{ display: "block" }}>
          © {year} ModParks. MIT License.
        </Typography>
      </Container>
    </Box>
  );
}
