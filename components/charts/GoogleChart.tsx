"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import { useLocale } from "next-intl";
import { loadGoogleCharts, type GoogleChartType } from "./googleCharts";

type Props = {
  type: GoogleChartType;
  /** 1 行目がヘッダーの二次元配列 */
  rows: unknown[][];
  options: object;
  height: number;
  errorText: string;
};

/** Google Charts の描画コンテナ。リサイズとテーマ変更で描き直す */
export default function GoogleChart({ type, rows, options, height, errorText }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const locale = useLocale();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;

    async function draw() {
      const google = await loadGoogleCharts(locale);
      const container = containerRef.current;
      if (disposed || !container) return;

      const data = google.visualization.arrayToDataTable(rows);
      const chart = new google.visualization[type](container);
      chart.draw(data, options);
      setReady(true);
    }

    // 初回描画とリサイズ時の再描画。CDN 障害でページ全体を落とさないよう握る
    function redraw() {
      draw().catch((err) => {
        console.error("[CHART] Failed to draw:", err);
        if (!disposed) setFailed(true);
      });
    }

    redraw();
    window.addEventListener("resize", redraw);

    return () => {
      disposed = true;
      window.removeEventListener("resize", redraw);
    };
  }, [type, rows, options, locale]);

  if (failed) {
    return <Typography variant="body2" color="text.secondary">{errorText}</Typography>;
  }

  return (
    <Box sx={{ position: "relative", height }}>
      {!ready && <Skeleton variant="rounded" width="100%" height={height} />}
      <Box
        ref={containerRef}
        sx={{ position: !ready ? "absolute" : "static", top: 0, left: 0, width: "100%", height, visibility: ready ? "visible" : "hidden" }}
      />
    </Box>
  );
}
