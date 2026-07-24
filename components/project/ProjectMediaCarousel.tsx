"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useTranslations } from "next-intl";

export type MediaItem = {
  id: string;
  url: string;
  caption: string | null;
};

/**
 * プロジェクトのスクリーンショットをカルーセル表示する。
 * featured 指定された画像のみをここに渡す想定。
 */
const ProjectMediaCarousel = ({ items }: { items: MediaItem[] }) => {
  const t = useTranslations("Common");
  const [index, setIndex] = useState(0);

  if (items.length === 0) return null;

  const current = items[index];
  const go = (delta: number) => setIndex((i) => (i + delta + items.length) % items.length);

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ position: "relative", borderRadius: 2, overflow: "hidden", bgcolor: "background.default" }}>
        <Box
          component="img"
          src={current.url}
          alt={current.caption ?? ""}
          loading="lazy"
          decoding="async"
          sx={{ display: "block", width: "100%", maxHeight: 480, objectFit: "contain" }}
        />

        {items.length > 1 && (
          <>
            <IconButton
              aria-label={t("back")}
              onClick={() => go(-1)}
              sx={{ position: "absolute", top: "50%", left: 8, transform: "translateY(-50%)", bgcolor: "rgba(0,0,0,0.4)", color: "#fff", "&:hover": { bgcolor: "rgba(0,0,0,0.6)" } }}
            >
              <ChevronLeftIcon />
            </IconButton>
            <IconButton
              aria-label={t("next")}
              onClick={() => go(1)}
              sx={{ position: "absolute", top: "50%", right: 8, transform: "translateY(-50%)", bgcolor: "rgba(0,0,0,0.4)", color: "#fff", "&:hover": { bgcolor: "rgba(0,0,0,0.6)" } }}
            >
              <ChevronRightIcon />
            </IconButton>
          </>
        )}
      </Box>

      {current.caption && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5, textAlign: "center" }}>
          {current.caption}
        </Typography>
      )}

      {items.length > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", gap: 1, mt: 1 }}>
          {items.map((item, i) => (
            <Box
              key={item.id}
              onClick={() => setIndex(i)}
              sx={{ width: 8, height: 8, borderRadius: "50%", cursor: "pointer", bgcolor: i === index ? "primary.main" : "divider" }}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

export default ProjectMediaCarousel;
