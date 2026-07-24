"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import { useTranslations } from "next-intl";

type ZoomableImageProps = {
  src: string;
  alt?: string;
  /** ドット絵(レシピ画像等)を拡大してもぼやけないようにする */
  pixelated?: boolean;
  className?: string;
  style?: React.CSSProperties;
  loading?: "lazy" | "eager";
};

/**
 * クリックで原寸大のダイアログ表示に切り替わる画像コンポーネント。
 * リンク内に置かれた画像には使用せず、その場合は通常の <img> を描画すること。
 */
const ZoomableImage = ({ src, alt, pixelated, className, style, loading }: ZoomableImageProps) => {
  const t = useTranslations("Common");
  const [open, setOpen] = useState(false);
  const rendering = pixelated ? "pixelated" : undefined;

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt || ""}
        loading={loading}
        className={className}
        onClick={() => setOpen(true)}
        style={{ cursor: "zoom-in", imageRendering: rendering, ...style }}
      />
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="lg" fullWidth>
        <Box sx={{ position: "relative", display: "flex", justifyContent: "center", bgcolor: "background.default" }}>
          <IconButton
            aria-label={t("close")}
            onClick={() => setOpen(false)}
            sx={{ position: "absolute", top: 8, right: 8, bgcolor: "background.paper", "&:hover": { bgcolor: "action.hover" } }}
          >
            <CloseIcon />
          </IconButton>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt || ""}
            style={{
              maxWidth: "100%",
              maxHeight: "85vh",
              objectFit: "contain",
              imageRendering: rendering,
            }}
          />
        </Box>
      </Dialog>
    </>
  );
};

export default ZoomableImage;
