"use client";

import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

interface AdSenseUnitProps {
  /** パブリッシャーID（`ca-pub-...`） */
  client: string;
  /** 広告ユニットID */
  slotId: string;
  /** 目安の高さ（px） */
  minHeight: number;
  /** スマホ幅（xs）で非表示にするか */
  hideOnMobile: boolean;
  /** 広告の形状 */
  format: "auto" | "horizontal" | "rectangle" | "vertical";
  /** 高さの上限（px）。未指定なら制限しない */
  maxHeight?: number;
}

/**
 * AdSense の広告ユニットを1枠描画する。
 * スクリプト自体はレイアウトで一度だけ読み込む前提で、ここでは push のみ行う。
 */
export default function AdSenseUnit({
  client,
  slotId,
  minHeight,
  hideOnMobile,
  format,
  maxHeight,
}: AdSenseUnitProps) {
  const pushedRef = useRef(false);

  useEffect(() => {
    // StrictMode の二重実行や再レンダリングで同じ枠を二度 push すると
    // AdSense 側で "already have ads in them" エラーになるため一度だけにする
    if (pushedRef.current) return;
    pushedRef.current = true;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // 広告の失敗でページを壊さない
    }
  }, []);

  return (
    <Box
      sx={{
        display: hideOnMobile ? { xs: "none", sm: "block" } : "block",
        width: "100%",
        minHeight,
        // 上限を超える広告が来ても枠からはみ出させない
        ...(maxHeight ? { maxHeight, overflow: "hidden" } : {}),
      }}
    >
      <ins
        className="adsbygoogle"
        style={{
          display: "block",
          // 未配信時などに白く塗られないよう、枠自体は透明にしておく
          background: "transparent",
          ...(maxHeight ? { maxHeight } : {}),
        }}
        data-ad-client={client}
        data-ad-slot={slotId}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </Box>
  );
}
