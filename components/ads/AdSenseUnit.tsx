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
}

/**
 * AdSense の広告ユニットを1枠描画する。
 * スクリプト自体はレイアウトで一度だけ読み込む前提で、ここでは push のみ行う。
 */
export default function AdSenseUnit({ client, slotId, minHeight, hideOnMobile }: AdSenseUnitProps) {
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
      }}
    >
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </Box>
  );
}
