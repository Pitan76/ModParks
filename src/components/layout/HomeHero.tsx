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
import Image from "next/image";
import { useTheme, alpha } from "@mui/material/styles";

interface HomeHeroProps {
  labels: {
    title: string;
    titleHighlight: string;
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
  const theme = useTheme();

  return (
    <Box
      sx={{
        position:   "relative",
        width:      "100%",
        minHeight:  { xs: 200, sm: 260, md: 320 },
        py:         { xs: 5, sm: 6, md: 8 },
        overflow:   "hidden",
        display:    "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* 背景画像 (直接フィルターで暗くすることで、テキストのmixBlendModeを正常に機能させます) */}
      <Image
        src="/hero.webp"
        alt="Home Hero"
        fill
        priority
        fetchPriority="high"
        sizes="100vw"
        style={{
          objectFit: "cover",
          zIndex: 0,
          filter: "brightness(0.45)",
        }}
      />

      <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1, color: "#fff" }}>
        <Box sx={{ textAlign: "center", maxWidth: "100%", mx: "auto" }}>

          <Box
            sx={{
              width: "100%",
              maxWidth: { xs: 260, sm: 280, md: 320 },
              mx: "auto",
              mb: 2,
              filter: "drop-shadow(0px 2px 3px rgba(0, 0, 0, 0.5))",
            }}
          >
            <svg viewBox="0 0 320 80" style={{ width: "100%", height: "auto", display: "block" }}>
              <defs>
                <linearGradient id="textGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#4ade80" />
                  <stop offset="100%" stopColor="#818cf8" />
                </linearGradient>
              </defs>
              <text
                x="50%"
                y="52%"
                dominantBaseline="central"
                textAnchor="middle"
                fill="none"
                stroke="url(#textGrad)"
                strokeWidth="1.5"
                style={{
                  fontWeight: 900,
                  fontFamily: "inherit",
                  fontSize: "44px",
                  letterSpacing: "1.5px",
                }}
              >
                {labels.title.replace(/\s+/g, "")}
              </text>
            </svg>
          </Box>

          {labels.titleHighlight && (
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                mb: 2,
                color: "transparent",
                WebkitTextStroke: "1px #818cf8",
                fontSize: { xs: "1.25rem", md: "1.75rem" }
              }}
            >
              {labels.titleHighlight}
            </Typography>
          )}

          <Typography
            variant="h6"
            sx={{
              mb: 5,
              fontWeight: 400,
              lineHeight: 1.6,
              px: { xs: 2, sm: 4 },
              color: "rgba(255, 255, 255, 0.9)",
              fontSize: { xs: "0.85rem", sm: "1rem", md: "1.25rem" },
              textShadow: "0px 1px 2px rgba(0, 0, 0, 0.6)",
            }}
          >
            {labels.description}
          </Typography>

          <Box sx={{ display: "flex", gap: { xs: 1, sm: 2 }, justifyContent: "center", flexWrap: "wrap" }}>
            <LinkButton
              href="/projects"
              id="hero-search-btn"
              variant="contained"
              size="large"
              startIcon={<SearchIcon />}
              sx={{
                px: { xs: 2.5, sm: 4 }, py: 1.5,
                fontSize: "1rem",
                whiteSpace: "nowrap",
                lineHeight: 1,
                "& .MuiButton-startIcon, & .MuiButton-endIcon": {
                  display: "inline-flex",
                  alignItems: "center",
                },
                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                backdropFilter: "blur(3px)",
                color: theme.palette.primary.main,
                fontWeight: 700,
                "&:hover": {
                  backgroundColor: alpha(theme.palette.primary.main, 0.25),
                  borderColor: alpha(theme.palette.primary.main, 0.45),
                }
              }}
            >
              {labels.search}
            </LinkButton>
            <LinkButton
              href="/projects/new"
              id="hero-cta-btn"
              variant="contained"
              size="large"
              endIcon={<ArrowForwardIcon />}
              sx={{
                px: { xs: 2.5, sm: 4 }, py: 1.5,
                fontSize: "1rem",
                whiteSpace: "nowrap",
                lineHeight: 1,
                "& .MuiButton-startIcon, & .MuiButton-endIcon": {
                  display: "inline-flex",
                  alignItems: "center",
                },
                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                backdropFilter: "blur(3px)",
                color: theme.palette.primary.main,
                fontWeight: 700,
                "&:hover": {
                  backgroundColor: alpha(theme.palette.primary.main, 0.25),
                  borderColor: alpha(theme.palette.primary.main, 0.45),
                }
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
                  sx={{
                    borderColor: "rgba(255, 255, 255, 0.3)",
                    color: "rgba(255, 255, 255, 0.8)",
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    "& .MuiChip-icon": { color: "inherit" }
                  }}
                />
              );
            })}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
