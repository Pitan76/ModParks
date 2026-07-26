"use client";

import { useRef, useState } from "react";

const SWIPE_THRESHOLD = 50;

type SwipeState = {
  dragX: number;
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onClickCapture: (e: React.MouseEvent) => void;
};

/**
 * ポインタの水平ドラッグでカルーセルをスライドさせる。
 * ドラッグ中は dragX(px) を返してトラックを指に追従させ、
 * 離した時にしきい値を超えていれば go() で移動する。
 */
export const useCarouselSwipe = (go: (delta: number) => void): SwipeState => {
  const startX = useRef<number | null>(null);
  const moved = useRef(false);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    moved.current = false;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (startX.current === null) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 4) moved.current = true;
    setDragX(dx);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (startX.current === null) return;
    const dx = e.clientX - startX.current;
    startX.current = null;
    setDragging(false);
    setDragX(0);
    if (Math.abs(dx) >= SWIPE_THRESHOLD) go(dx < 0 ? 1 : -1);
  };

  const onClickCapture = (e: React.MouseEvent) => {
    if (!moved.current) return;
    e.stopPropagation();
    e.preventDefault();
    moved.current = false;
  };

  return { dragX, dragging, onPointerDown, onPointerMove, onPointerUp, onClickCapture };
};
