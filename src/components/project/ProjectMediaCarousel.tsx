"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useTranslations } from "next-intl";
import ZoomableImage from "@/components/ui/ZoomableImage";
import { useCarouselSwipe } from "./useCarouselSwipe";

export type MediaItem = {
  id: string;
  url: string;
  caption: string | null;
};

const getYouTubeId = (url: string): string | null => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

const getNicoVideoId = (url: string): string | null => {
  const regExp = /^.*(nicovideo\.jp\/watch\/|nico\.ms\/)(sm\d+|so\d+|\d+).*/;
  const match = url.match(regExp);
  return match ? match[2] : null;
};

const EmbedFrame = ({ src, title }: { src: string; title: string }) => (
  <Box sx={{ width: "100%", aspectRatio: "16/9", maxHeight: 480, display: "block" }}>
    <iframe
      src={src}
      title={title}
      style={{ border: 0, width: "100%", height: "100%" }}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  </Box>
);

const Slide = ({ item }: { item: MediaItem }) => {
  const ytId = getYouTubeId(item.url);
  const nicoId = getNicoVideoId(item.url);

  if (ytId) return <EmbedFrame src={`https://www.youtube.com/embed/${ytId}`} title={item.caption || "YouTube video"} />;
  if (nicoId) return <EmbedFrame src={`https://embed.nicovideo.jp/watch/${nicoId}`} title={item.caption || "NicoNico video"} />;

  return (
    <ZoomableImage
      src={item.url}
      alt={item.caption ?? ""}
      loading="lazy"
      style={{ display: "block", width: "100%", maxHeight: 480, objectFit: "contain" }}
    />
  );
};

const navBtnSx = (side: "left" | "right") => ({
  position: "absolute" as const,
  top: "50%",
  [side]: 8,
  transform: "translateY(-50%)",
  bgcolor: "rgba(0,0,0,0.4)",
  color: "#fff",
  "&:hover": { bgcolor: "rgba(0,0,0,0.6)" },
  zIndex: 1,
});

/**
 * プロジェクトのスクリーンショットをカルーセル表示する。
 * featured 指定された画像のみをここに渡す想定。
 */
const ProjectMediaCarousel = ({ items }: { items: MediaItem[] }) => {
  const t = useTranslations("Common");
  const [index, setIndex] = useState(0);
  const go = (delta: number) => setIndex((i) => (i + delta + items.length) % items.length);
  const swipe = useCarouselSwipe(go);

  if (items.length === 0) return null;

  const multiple = items.length > 1;
  const current = items[index];
  const trackX = `calc(${-index * 100}% + ${swipe.dragX}px)`;

  return (
    <Box sx={{ mb: 3 }}>
      <Box
        onPointerDown={multiple ? swipe.onPointerDown : undefined}
        onPointerMove={multiple ? swipe.onPointerMove : undefined}
        onPointerUp={multiple ? swipe.onPointerUp : undefined}
        onPointerCancel={multiple ? swipe.onPointerUp : undefined}
        onClickCapture={multiple ? swipe.onClickCapture : undefined}
        sx={{
          position: "relative",
          borderRadius: 0,
          overflow: "hidden",
          bgcolor: "background.default",
          touchAction: multiple ? "pan-y" : undefined,
          cursor: multiple ? "grab" : undefined,
          "&:active": multiple ? { cursor: "grabbing" } : undefined,
        }}
      >
        <Box
          sx={{
            display: "flex",
            transform: `translateX(${trackX})`,
            transition: swipe.dragging ? "none" : "transform 0.35s ease",
          }}
        >
          {items.map((item) => (
            <Box key={item.id} sx={{ flex: "0 0 100%", minWidth: 0 }}>
              <Slide item={item} />
            </Box>
          ))}
        </Box>

        {multiple && (
          <>
            <IconButton aria-label={t("back")} onClick={() => go(-1)} sx={navBtnSx("left")}>
              <ChevronLeftIcon />
            </IconButton>
            <IconButton aria-label={t("next")} onClick={() => go(1)} sx={navBtnSx("right")}>
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

      {multiple && (
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
