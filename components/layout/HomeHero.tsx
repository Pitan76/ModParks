"use client";

import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import SearchIcon from "@mui/icons-material/Search";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import LinkButton from "@/components/ui/LinkButton";
import { useColorMode } from "@/components/ThemeRegistry";
import { getLoaderInfo } from "@/lib/loaders";

interface HomeHeroProps {
  labels: {
    title: string;
    description: string;
    search: string;
    cta: string;
  };
}

/**
 * ホームページの上部に表示するヒーローセクション。
 * 新テーマ時は背景グラデーションから紫を排除し、モノトーン基調に合わせた配色へ切り替える。
 */
export default function HomeHero({ labels }: HomeHeroProps) {
  const { isNewTheme } = useColorMode();

  return (
    <Box
      sx={{
        position:   "relative",
        py:         { xs: 6, md: 10 },
        overflow:   "hidden",
        "&::before": {
          content:  '""',
          position: "absolute",
          inset:    0,
        },
      }}
    >
      <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1 }}>
        <Box sx={{ textAlign: "center", maxWidth: 720, mx: "auto" }}>
          <Typography
            variant="h2"
            component="h1"
            sx={{
              fontWeight:   800,
              mb:           2,
              lineHeight:   1.25,
              fontSize:     { xs: "1.75rem", md: "2.5rem" },
            }}
          >
            {labels.title}
          </Typography>

          <Typography
            variant="h6"
            color="text.secondary"
            sx={{ mb: 5, fontWeight: 400, lineHeight: 1.6, px: { xs: 2, sm: 4 } }}
          >
            {labels.description}
          </Typography>

          <Box sx={{ display: "flex", gap: 2, justifyContent: "center", flexWrap: "wrap" }}>
            <LinkButton
              href="/projects"
              id="hero-search-btn"
              variant="contained"
              size="large"
              startIcon={<SearchIcon />}
              sx={{ px: 4, py: 1.5, fontSize: "1rem" }}
            >
              {labels.search}
            </LinkButton>
            <LinkButton
              href="/projects/new"
              id="hero-cta-btn"
              variant="outlined"
              size="large"
              endIcon={<ArrowForwardIcon />}
              sx={{
                px: 4, py: 1.5, fontSize: "1rem",
                borderColor: "primary.main",
                color:        "primary.main",
              }}
            >
              {labels.cta}
            </LinkButton>
          </Box>

          <Box sx={{ display: "flex", gap: 1, justifyContent: "center", mt: 4, flexWrap: "wrap" }}>
            {["Fabric", "Forge", "NeoForge", "Paper", "Spigot", "Quilt"].map((l) => {
              const info = getLoaderInfo(l.toLowerCase());
              return (
                <Chip
                  key={l}
                  label={info.name}
                  variant="outlined"
                  size="small"
                  icon={info.icon}
                  sx={{ borderColor: "divider", color: "text.secondary" }}
                />
              );
            })}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
