"use client";

import * as React from "react";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import { useTranslations } from "next-intl";
import { usePins } from "./PinProvider";
import type { PinItemType } from "@/lib/pins";
import type { ContextMenuItem } from "@/components/ui/ContextMenu";

/**
 * カードのコンテキストメニューに差し込むピン留め項目を返す。
 * 未ログイン時（Provider が無効）は null を返すので、呼び出し側で除外できる。
 *
 * @example
 * const pinItem = usePinMenuItem("project", project.id);
 * useContextMenu([ ...(pinItem ? [{ type: "divider" }, pinItem] : []) ]);
 */
export function usePinMenuItem(itemType: PinItemType, itemId: string): ContextMenuItem | null {
  const pins = usePins();
  const t = useTranslations("ContextMenu");

  if (!pins || !pins.enabled) return null;

  const pinned = pins.isPinned(itemType, itemId);

  return {
    id: pinned ? "cm-unpin" : "cm-pin",
    label: pinned ? t("unpin") : t("pin"),
    icon: pinned ? <PushPinIcon fontSize="small" /> : <PushPinOutlinedIcon fontSize="small" />,
    onClick: () => {
      void pins.toggle(itemType, itemId);
    },
  };
}
