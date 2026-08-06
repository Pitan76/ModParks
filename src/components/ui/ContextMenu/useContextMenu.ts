"use client";

import * as React from "react";
import { useContextMenuContext } from "./ContextMenuProvider";
import type { ContextMenuItems, UseContextMenuOptions } from "./types";

/**
 * 右クリックで独自コンテキストメニューを開くハンドラを返す。
 *
 * @example
 * const onContextMenu = useContextMenu([
 *   { id: "open", label: "開く", href: `/projects/${slug}` },
 *   { type: "divider" },
 *   { id: "share", label: "共有", icon: <ShareIcon fontSize="small" />, onClick: () => share() },
 * ]);
 * return <Card onContextMenu={onContextMenu}>…</Card>;
 *
 * Shift+右クリック / リンク・画像・テキスト選択中は自動でブラウザ標準メニューに素通しする。
 */
export function useContextMenu(
  items: ContextMenuItems,
  options?: UseContextMenuOptions,
): (event: React.MouseEvent) => void {
  const { open } = useContextMenuContext();
  const itemsRef = React.useRef(items);
  const optionsRef = React.useRef(options);

  React.useEffect(() => {
    itemsRef.current = items;
    optionsRef.current = options;
  });

  return React.useCallback(
    (event: React.MouseEvent) => open(event, itemsRef.current, optionsRef.current),
    [open],
  );
}

/**
 * リスト内などで項目が要素ごとに異なる場合に使う低レベルAPI。
 * 返り値 `open(event, items, options?)` を各要素の onContextMenu で呼ぶ。
 * （`.map` の中で `useContextMenu` を呼ぶとフックのルール違反になるため）
 *
 * @example
 * const openMenu = useContextMenuHandler();
 * rows.map((r) => <tr onContextMenu={(e) => openMenu(e, buildItems(r))}>…</tr>);
 */
export function useContextMenuHandler() {
  return useContextMenuContext().open;
}
