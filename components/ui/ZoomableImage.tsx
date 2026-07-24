"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import CloseIcon from "@mui/icons-material/Close";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import FitScreenIcon from "@mui/icons-material/FitScreen";
import { useTranslations } from "next-intl";
import { useImageZoom } from "./useImageZoom";

type ZoomableImageProps = {
  src: string;
  alt?: string;
  /** ドット絵(レシピ画像等)を拡大してもぼやけないようにする */
  pixelated?: boolean;
  className?: string;
  style?: React.CSSProperties;
  loading?: "lazy" | "eager";
};

const ZOOM_STEP = 1.4;

/**
 * クリックでズーム表示ダイアログを開く画像コンポーネント。
 * ダイアログではホイール/ボタンでの拡大縮小、ドラッグでの移動ができる。
 * リンク内に置かれた画像には使用せず、その場合は通常の <img> を描画すること。
 */
const ZoomableImage = ({ src, alt, pixelated, className, style, loading }: ZoomableImageProps) => {
  const t = useTranslations("Common");
  const [open, setOpen] = useState(false);
  const zoom = useImageZoom();
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
      <Dialog open={open} onClose={() => setOpen(false)} fullScreen slotProps={{ paper: { sx: { bgcolor: "rgba(0,0,0,0.92)" } } }}>
        <Box
          ref={zoom.viewportRef}
          onWheel={zoom.handleWheel}
          onPointerDown={zoom.handlePointerDown}
          onPointerMove={zoom.handlePointerMove}
          onPointerUp={zoom.handlePointerUp}
          onPointerCancel={zoom.handlePointerUp}
          onDoubleClick={zoom.toggleActualSize}
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            touchAction: "none",
            cursor: "grab",
            "&:active": { cursor: "grabbing" },
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt || ""}
            onLoad={zoom.handleImageLoad}
            draggable={false}
            style={{
              maxWidth: "none",
              maxHeight: "none",
              imageRendering: rendering,
              transform: `translate(${zoom.transform.x}px, ${zoom.transform.y}px) scale(${zoom.transform.scale})`,
              transformOrigin: "center center",
              willChange: "transform",
            }}
          />
        </Box>
        <Stack direction="row" spacing={1} sx={{ position: "absolute", top: 8, right: 8 }}>
          <Tooltip title={t("zoomOut")}>
            <IconButton aria-label={t("zoomOut")} onClick={() => zoom.zoomBy(1 / ZOOM_STEP)} sx={controlSx}>
              <ZoomOutIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={t("zoomIn")}>
            <IconButton aria-label={t("zoomIn")} onClick={() => zoom.zoomBy(ZOOM_STEP)} sx={controlSx}>
              <ZoomInIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={t("zoomFit")}>
            <IconButton aria-label={t("zoomFit")} onClick={zoom.fit} sx={controlSx}>
              <FitScreenIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={t("close")}>
            <IconButton aria-label={t("close")} onClick={() => setOpen(false)} sx={controlSx}>
              <CloseIcon />
            </IconButton>
          </Tooltip>
        </Stack>
        <Box sx={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", color: "common.white", fontSize: 13 }}>
          {Math.round(zoom.transform.scale * 100)}%
        </Box>
      </Dialog>
    </>
  );
};

const controlSx = {
  color: "common.white",
  bgcolor: "rgba(0,0,0,0.5)",
  "&:hover": { bgcolor: "rgba(0,0,0,0.7)" },
};

export default ZoomableImage;
