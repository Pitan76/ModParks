"use client";

import * as React from "react";
import Snackbar from "@mui/material/Snackbar";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { togglePin } from "@/lib/actions/profilePins";
import { MAX_PINS, type PinItemType, type PinRef } from "@/lib/pins";
import { readPinCache, readPinCacheFetchedAt, writePinCache } from "./pinCache";

interface PinContextValue {
  /** ログイン中か（未ログインならピン留めメニューを出さない） */
  enabled: boolean;
  count: number;
  isPinned: (itemType: PinItemType, itemId: string) => boolean;
  toggle: (itemType: PinItemType, itemId: string) => Promise<void>;
}

const PinContext = React.createContext<PinContextValue | null>(null);

/** カードからピン留め状態・操作を参照する。Provider 外なら null を返す。 */
export function usePins(): PinContextValue | null {
  return React.useContext(PinContext);
}

/** 読めなければ空として扱う。ピン留め表示が欠けるだけで、画面は壊さない */
async function fetchMyPins(): Promise<PinRef[]> {
  const res = await fetch("/api/pins/mine", { cache: "no-store" });
  if (!res.ok) return [];

  return (await res.json()) as PinRef[];
}

/**
 * 表示に使うピン留めのキー集合。控えが新しければそれを使い、無ければ取得して控える。
 * 未ログインでは自分でピン留めできないので空。
 */
async function loadPinnedKeys(enabled: boolean, userId: string): Promise<Set<string>> {
  if (!enabled || !userId) return new Set();

  const cached = readPinCache(userId);
  if (cached) return cached;

  const keys = new Set((await fetchMyPins()).map((p) => keyOf(p.itemType, p.itemId)));
  writePinCache(userId, keys);

  return keys;
}

function keyOf(itemType: PinItemType, itemId: string) {
  return `${itemType}:${itemId}`;
}

export default function PinProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const t = useTranslations("ContextMenu");
  const enabled = status === "authenticated";
  const userId = session?.user?.id ?? "";

  const [pinned, setPinned] = React.useState<Set<string>>(new Set());
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    // ここで保持するのは「ログイン中の本人が自分の何をピン留め済みか」だけ。
    // 用途は右クリックメニューのラベル切替と6件上限判定に限られる。
    // （プロフィールへの公開表示は別途サーバー側 getPinnedItems が全員向けに描画する）
    // 端末内の控えが新しいうちはサーバへ問い合わせない（pinCache.ts を参照）。
    // いずれも非同期コールバック内で setState し、エフェクト本体からの同期 setState を避ける。
    (async () => {
      const keys = await loadPinnedKeys(enabled, userId);
      if (!cancelled) setPinned(keys);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, userId]);

  const isPinned = React.useCallback(
    (itemType: PinItemType, itemId: string) => pinned.has(keyOf(itemType, itemId)),
    [pinned]
  );

  const toggle = React.useCallback(
    async (itemType: PinItemType, itemId: string) => {
      const key = keyOf(itemType, itemId);
      const wasPinned = pinned.has(key);

      // 上限チェック（追加時のみ）。楽観更新前に弾いてトーストを出す。
      if (!wasPinned && pinned.size >= MAX_PINS) {
        setToast(t("pinLimit", { max: MAX_PINS }));
        return;
      }

      // 楽観更新
      setPinned((prev) => {
        const next = new Set(prev);
        if (wasPinned) next.delete(key);
        else next.add(key);
        return next;
      });

      const result = await togglePin(itemType, itemId);

      if ("error" in result) {
        // サーバー側で上限に達していた場合はロールバック
        setPinned((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        setToast(t("pinLimit", { max: MAX_PINS }));
        return;
      }

      const next = new Set(pinned);
      if (result.pinned) next.add(key);
      else next.delete(key);
      writePinCache(userId, next, readPinCacheFetchedAt());

      setToast(result.pinned ? t("pinned") : t("unpinned"));
    },
    [pinned, t, userId]
  );

  const value = React.useMemo<PinContextValue>(
    () => ({ enabled, count: pinned.size, isPinned, toggle }),
    [enabled, pinned.size, isPinned, toggle]
  );

  return (
    <PinContext.Provider value={value}>
      {children}
      <Snackbar
        open={toast !== null}
        autoHideDuration={2500}
        onClose={() => setToast(null)}
        message={toast ?? ""}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </PinContext.Provider>
  );
}
