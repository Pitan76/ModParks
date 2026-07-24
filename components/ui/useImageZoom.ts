"use client";

import { useCallback, useRef, useState } from "react";

const MIN_SCALE = 0.1;
const MAX_SCALE = 16;
const WHEEL_SENSITIVITY = 0.0015;

export type ImageZoomTransform = {
  scale: number;
  x: number;
  y: number;
};

const clampScale = (scale: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

/** 表示領域に収まる倍率。小さい画像は拡大され、大きい画像は縮小される */
const calcFitScale = (viewport: DOMRect, width: number, height: number) => {
  if (!width || !height) return 1;
  return clampScale(Math.min(viewport.width / width, viewport.height / height));
};

/**
 * ビューポート中心を基準に拡大縮小・パンを行うズーム状態を管理する。
 * 画像は原寸で描画し、transform で表示倍率を制御する前提。
 */
export const useImageZoom = () => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const naturalRef = useRef({ width: 0, height: 0 });
  const fitScaleRef = useRef(1);
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const [transform, setTransform] = useState<ImageZoomTransform>({ scale: 1, x: 0, y: 0 });

  const fit = useCallback(() => {
    const viewport = viewportRef.current?.getBoundingClientRect();
    if (!viewport) return;
    const { width, height } = naturalRef.current;
    fitScaleRef.current = calcFitScale(viewport, width, height);
    setTransform({ scale: fitScaleRef.current, x: 0, y: 0 });
  }, []);

  const handleImageLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const image = event.currentTarget;
      naturalRef.current = { width: image.naturalWidth, height: image.naturalHeight };
      fit();
    },
    [fit],
  );

  /** origin はビューポート中心からの相対座標。指定なしなら中心基準 */
  const zoomTo = useCallback((nextScale: number, origin?: { x: number; y: number }) => {
    setTransform((prev) => {
      const scale = clampScale(nextScale);
      const ratio = scale / prev.scale;
      const ox = origin?.x ?? 0;
      const oy = origin?.y ?? 0;
      return {
        scale,
        x: ox - (ox - prev.x) * ratio,
        y: oy - (oy - prev.y) * ratio,
      };
    });
  }, []);

  const zoomBy = useCallback((factor: number) => zoomTo(transform.scale * factor), [transform.scale, zoomTo]);

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      const viewport = viewportRef.current?.getBoundingClientRect();
      if (!viewport) return;
      const origin = {
        x: event.clientX - (viewport.left + viewport.width / 2),
        y: event.clientY - (viewport.top + viewport.height / 2),
      };
      zoomTo(transform.scale * Math.exp(-event.deltaY * WHEEL_SENSITIVITY), origin);
    },
    [transform.scale, zoomTo],
  );

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    dragRef.current = { ...drag, x: event.clientX, y: event.clientY };
    setTransform((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
  }, []);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
  }, []);

  /** フィット倍率と等倍を往復する */
  const toggleActualSize = useCallback(() => {
    if (Math.abs(transform.scale - 1) < 0.01) {
      setTransform({ scale: fitScaleRef.current, x: 0, y: 0 });
      return;
    }
    setTransform({ scale: 1, x: 0, y: 0 });
  }, [transform.scale]);

  return {
    viewportRef,
    transform,
    handleImageLoad,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    toggleActualSize,
    zoomBy,
    fit,
  };
};
