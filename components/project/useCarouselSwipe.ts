"use client";

import { useRef } from "react";

const SWIPE_THRESHOLD = 50;

type SwipeHandlers = {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onClickCapture: (e: React.MouseEvent) => void;
};

/**
 * ポインタの水平ドラッグでカルーセルをスライドさせる。
 * ドラッグ後の click は子要素(ズーム画像)へ伝えないよう抑制する。
 */
export const useCarouselSwipe = (go: (delta: number) => void): SwipeHandlers => {
  const startX = useRef<number | null>(null);
  const dragged = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    dragged.current = false;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (startX.current === null) return;
    const dx = e.clientX - startX.current;
    startX.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    dragged.current = true;
    go(dx < 0 ? 1 : -1);
  };

  const onClickCapture = (e: React.MouseEvent) => {
    if (!dragged.current) return;
    e.stopPropagation();
    e.preventDefault();
    dragged.current = false;
  };

  return { onPointerDown, onPointerUp, onClickCapture };
};
