"use client";

import * as React from "react";

/** 長押しから合成された contextmenu イベントに立てる印 */
export const LONG_PRESS_FLAG = "__contextMenuLongPress";

/** 長押し判定までの時間(ms) */
const LONG_PRESS_DELAY = 500;
/** これ以上動いたらスクロール扱いでキャンセル(px) */
const MOVE_TOLERANCE = 10;
/** ネイティブ contextmenu 直後は合成しない猶予(ms) */
const NATIVE_GUARD = 1000;

export interface TouchPoint {
  x: number;
  y: number;
}

/** 長押し由来のイベントかどうか */
export function isLongPressEvent(event: React.MouseEvent): boolean {
  return Boolean((event.nativeEvent as unknown as Record<string, unknown>)?.[LONG_PRESS_FLAG]);
}

function dispatchSyntheticContextMenu(node: EventTarget, point: TouchPoint) {
  const event = new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: point.x,
    clientY: point.y,
    button: 2,
  });
  Object.defineProperty(event, LONG_PRESS_FLAG, { value: true });
  node.dispatchEvent(event);
}

/**
 * iOS Safari は長押しで contextmenu を発火しないため、
 * タッチ長押しを検出して contextmenu を合成ディスパッチする。
 * 直近タッチ座標も返す（長押し以外の経路で clientX/Y が 0 になる場合の補完用）。
 */
export function useLongPressContextMenu(enabled: boolean) {
  const lastTouchRef = React.useRef<TouchPoint | null>(null);

  React.useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let start: TouchPoint | null = null;
    let node: EventTarget | null = null;
    let lastNativeAt = 0;

    const clear = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };

    const handleNative = () => {
      lastNativeAt = Date.now();
      clear();
    };

    const handleTouchStart = (e: TouchEvent) => {
      clear();
      if (e.touches.length !== 1) return;

      const touch = e.touches[0];
      const point = { x: touch.clientX, y: touch.clientY };
      lastTouchRef.current = point;
      start = point;
      node = e.target;

      timer = setTimeout(() => {
        timer = null;
        if (!node || !start) return;
        if (Date.now() - lastNativeAt < NATIVE_GUARD) return;
        window.getSelection?.()?.removeAllRanges();
        dispatchSyntheticContextMenu(node, start);
      }, LONG_PRESS_DELAY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
      if (!start) return;
      const moved = Math.hypot(touch.clientX - start.x, touch.clientY - start.y);
      if (moved > MOVE_TOLERANCE) clear();
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", clear, { passive: true });
    window.addEventListener("touchcancel", clear, { passive: true });
    window.addEventListener("scroll", clear, { passive: true, capture: true });
    window.addEventListener("contextmenu", handleNative, true);

    return () => {
      clear();
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", clear);
      window.removeEventListener("touchcancel", clear);
      window.removeEventListener("scroll", clear, true);
      window.removeEventListener("contextmenu", handleNative, true);
    };
  }, [enabled]);

  return lastTouchRef;
}
