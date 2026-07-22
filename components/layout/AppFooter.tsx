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
import { useTranslations } from "next-intl";

/**
 * アプリケーションの共通フッターコンポーネント。
 * コピーライト表記、ドキュメントWikiへのリンク、RSSフィード、GitHubリポジトリへのリンク、
 * 利用規約およびプライバシーポリシーへのリンクを表示します。
 */
const AppFooter = () => {
  const year = new Date().getFullYear();
  const t = useTranslations("Footer");

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
              {t("description")}
            </Typography>
          </Box>

          {/* リンク群 */}
          <Stack spacing={1.5} sx={{ alignItems: { xs: "center", md: "flex-end" } }}>
            {/* 上段: 外部ツール・リソース */}
            <Stack direction="row" spacing={2.5} sx={{ alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
              <Link
                href="https://doku.wikichree.com/modparks"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: "text.secondary", fontSize: "0.875rem" }}
              >
                Wiki
              </Link>
              <Link
                href="/feed.xml"
                target="_blank"
                rel="noopener noreferrer"
                id="footer-rss"
                sx={{ color: "text.secondary", display: "flex", alignItems: "center", gap: 0.5, fontSize: "0.875rem" }}
              >
                <RssFeedIcon fontSize="small" />
                RSS
              </Link>
              <Link
                href="https://github.com/Pitan76/ModParks"
                target="_blank"
                rel="noopener noreferrer"
                id="footer-github"
                sx={{ color: "text.secondary", display: "flex", alignItems: "center", gap: 0.5, fontSize: "0.875rem" }}
              >
                <GitHubIcon fontSize="small" />
                Web
              </Link>
              <Link
                href="https://github.com/Pitan76/ModParks-CLI"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: "text.secondary", display: "flex", alignItems: "center", gap: 0.5, fontSize: "0.875rem" }}
              >
                <GitHubIcon fontSize="small" />
                CLI
              </Link>
            </Stack>

            {/* 下段: 法的情報 */}
            <Stack direction="row" spacing={3} sx={{ alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
              <Link
                component={NextLink}
                href="/terms"
                prefetch={false}
                sx={{ color: "text.secondary", fontSize: "0.875rem" }}
              >
                {t("terms")}
              </Link>
              <Link
                component={NextLink}
                href="/privacy"
                prefetch={false}
                sx={{ color: "text.secondary", fontSize: "0.875rem" }}
              >
                {t("privacy")}
              </Link>
            </Stack>
          </Stack>
        </Stack>

        <Divider sx={{ my: 3 }} />

        <Typography variant="caption" color="text.disabled" align="center" sx={{ display: "block" }}>
          © {year} ModParks. MIT License.
        </Typography>
      </Container>
    </Box>
  );
};

export default AppFooter;
