"use client";

import * as React from "react";
import Snackbar from "@mui/material/Snackbar";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { getMyPins, togglePin, MAX_PINS, type PinItemType, type PinRef } from "@/lib/actions/profilePins";

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

function keyOf(itemType: PinItemType, itemId: string) {
  return `${itemType}:${itemId}`;
}

export default function PinProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const t = useTranslations("ContextMenu");
  const enabled = status === "authenticated";

  const [pinned, setPinned] = React.useState<Set<string>>(new Set());
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!enabled) {
      setPinned(new Set());
      return;
    }
    let cancelled = false;
    getMyPins().then((pins: PinRef[]) => {
      if (!cancelled) setPinned(new Set(pins.map((p) => keyOf(p.itemType, p.itemId))));
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

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

      setToast(result.pinned ? t("pinned") : t("unpinned"));
    },
    [pinned, t]
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
