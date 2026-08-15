"use client";

import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import GitHubIcon from "@mui/icons-material/GitHub";
import RssFeedIcon from "@mui/icons-material/RssFeed";
import { Link as NextLink } from "@/lib/i18n/routing";
import { useTranslations } from "next-intl";

/**
 * アプリケーションの共通フッターコンポーネント。
 * コピーライト表記、ドキュメントWikiへのリンク、RSSフィード、GitHubリポジトリへのリンク、
 * 法的情報（利用規約・プライバシーポリシー・外部送信ポリシー・権利侵害の申出窓口）への
 * リンクを表示します。外部送信ポリシーと非公式である旨の表示は、全ページから
 * 到達できる必要があるためここに置いています。
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
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              {t("contact")}:{" "}
              <Link href="mailto:admin@pitan76.net" color="inherit" sx={{ textDecoration: "underline" }}>
                admin@pitan76.net
              </Link>
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
              {/* 外部送信規律は「容易に知り得る状態」に置くことが要件のため、
                  全ページ共通のフッターから1クリックで到達できるようにする */}
              <Link
                component={NextLink}
                href="/external-transmission"
                prefetch={false}
                sx={{ color: "text.secondary", fontSize: "0.875rem" }}
              >
                {t("externalTransmission")}
              </Link>
              {/* 権利侵害の申出は、アカウントを持たない権利者からも届く必要がある。
                  サイト内の通報機能はログイン利用者向けなので、ここにも導線を置く */}
              <Link
                href="mailto:admin@pitan76.net?subject=Rights%20infringement%20report"
                sx={{ color: "text.secondary", fontSize: "0.875rem" }}
              >
                {t("reportAbuse")}
              </Link>
            </Stack>
          </Stack>
        </Stack>

        <Divider sx={{ my: 3 }} />

        {/* アカウントとデータ取得目的の明示。Google OAuth の審査要件で
            ホームページ上に記載が必要なため、全ページ共通のフッターに置く。 */}
        <Typography
          variant="caption"
          color="text.secondary"
          align="center"
          sx={{ display: "block", maxWidth: 720, mx: "auto", mb: 1.5, lineHeight: 1.8 }}
        >
          {t("dataNotice")}
        </Typography>

        {/* Minecraft のブランド利用ガイドライン上、非公式である旨を明示しておく */}
        <Typography
          variant="caption"
          color="text.disabled"
          align="center"
          sx={{ display: "block", maxWidth: 720, mx: "auto", mb: 1, lineHeight: 1.8 }}
        >
          {t("notAffiliated")}
        </Typography>

        <Typography variant="caption" color="text.disabled" align="center" sx={{ display: "block" }}>
          © {year} ModParks. MIT License.
        </Typography>
      </Container>
    </Box>
  );
};

export default AppFooter;
