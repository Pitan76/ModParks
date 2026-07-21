"use client";

import * as React from "react";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import Snackbar from "@mui/material/Snackbar";
import OpenInBrowserIcon from "@mui/icons-material/OpenInBrowser";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/routing";

import type {
  ContextMenuItem,
  ContextMenuItems,
  ContextMenuTarget,
  UseContextMenuOptions,
} from "./types";

interface OpenState {
  position: { top: number; left: number };
  items: ContextMenuItem[];
  target: ContextMenuTarget;
  includeBrowserItem: boolean;
}

interface ContextMenuContextValue {
  open: (
    event: React.MouseEvent,
    items: ContextMenuItems,
    options?: UseContextMenuOptions,
  ) => void;
  /** 共有・コピー等の完了通知を出す */
  notify: (message: string) => void;
}

const ContextMenuContext = React.createContext<ContextMenuContextValue | null>(null);

/** 右クリックされた対象から素通し判定用の情報を取り出す */
function buildTarget(event: React.MouseEvent): ContextMenuTarget {
  const node = event.target as HTMLElement;
  const selectionText = (typeof window !== "undefined" && window.getSelection?.()?.toString()) || "";
  return {
    event,
    node,
    link: node.closest?.("a[href]") as HTMLAnchorElement | null,
    image: (node.closest?.("img") as HTMLImageElement | null) ?? null,
    selectionText: selectionText.trim(),
    editable: Boolean(
      node.closest?.("input, textarea, [contenteditable=''], [contenteditable='true']"),
    ),
  };
}

/** ネイティブメニューへ素通しすべきか（true ならメニューを出さない） */
export function shouldPassthrough(
  event: React.MouseEvent,
  target: ContextMenuTarget,
  options?: UseContextMenuOptions,
): boolean {
  // Shift+右クリックは常にネイティブへ
  if (event.shiftKey) return true;

  const p = options?.passthrough ?? {};
  if ((p.links ?? true) && target.link) return true;
  if ((p.images ?? true) && target.image) return true;
  if ((p.selection ?? true) && target.selectionText.length > 0) return true;
  if ((p.editable ?? true) && target.editable) return true;
  return false;
}

export function useContextMenuContext(): ContextMenuContextValue {
  const ctx = React.useContext(ContextMenuContext);
  if (!ctx) {
    throw new Error("useContextMenu は <ContextMenuProvider> の内側で使ってください");
  }
  return ctx;
}

export default function ContextMenuProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<OpenState | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const locale = useLocale();
  const router = useRouter();

  const notify = React.useCallback((message: string) => setToast(message), []);

  const browserLabel = locale === "en" ? "Browser menu (Shift + right-click)" : "ブラウザ標準メニュー（Shift+右クリック）";
  const browserToastLabel = locale === "en"
    ? "To open the browser's default menu, hold down the Shift key and right-click."
    : "ブラウザの標準メニューを開くには、Shiftキーを押しながら右クリックしてください。";

  const open = React.useCallback<ContextMenuContextValue["open"]>((event, items, options) => {
    const isCustomMenuDisabled = typeof window !== "undefined" && window.localStorage.getItem("disable_custom_context_menu") === "true";
    if (isCustomMenuDisabled) return; // カスタムメニュー無効時はブラウザ標準を表示

    const target = buildTarget(event);
    if (shouldPassthrough(event, target, options)) return; // ネイティブメニューを妨害しない

    event.preventDefault();
    event.stopPropagation();

    const resolved = typeof items === "function" ? items(target) : items;
    if (resolved.length === 0) return;

    setState({
      position: { top: event.clientY, left: event.clientX },
      items: resolved,
      target,
      includeBrowserItem: options?.includeBrowserItem ?? true,
    });
  }, []);

  const close = React.useCallback(() => setState(null), []);

  const value = React.useMemo<ContextMenuContextValue>(() => ({ open, notify }), [open, notify]);

  return (
    <ContextMenuContext.Provider value={value}>
      {children}
      <Menu
        open={state !== null}
        onClose={close}
        anchorReference="anchorPosition"
        anchorPosition={state ? { top: state.position.top, left: state.position.left } : undefined}
        slotProps={{ paper: { sx: { minWidth: 200 } } }}
      >
        {state?.items.map((item, index) => {
          if (item.type === "divider") {
            return <Divider key={`divider-${index}`} />;
          }
          return (
            <MenuItem
              key={item.id ?? `item-${index}`}
              id={item.id}
              disabled={item.disabled}
              onClick={() => {
                if (item.href) {
                  router.push(item.href);
                } else {
                  item.onClick?.(state.target);
                }
                close();
              }}
              sx={item.danger ? { color: "error.main" } : undefined}
            >
              {item.icon && (
                <ListItemIcon sx={item.danger ? { color: "error.main" } : undefined}>
                  {item.icon}
                </ListItemIcon>
              )}
              <ListItemText inset={!item.icon}>{item.label}</ListItemText>
              {item.shortcut && (
                <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                  {item.shortcut}
                </Typography>
              )}
            </MenuItem>
          );
        })}

        {state?.includeBrowserItem && [
          <Divider key="browser-divider" />,
          // JS からネイティブメニューは開けないため、Shift+右クリックを案内する項目
          <MenuItem key="browser-hint" onClick={() => {
            close();
            const confirmDisable = window.confirm(
              locale === "en"
                ? "Would you like to disable this custom context menu and always use the browser's default menu? (You can re-enable it in Settings -> Theme Settings)"
                : "このカスタムコンテキストメニューを無効化し、常にブラウザの標準メニューを表示しますか？（設定 -> テーマ設定から再度有効化できます）"
            );
            if (confirmDisable) {
              window.localStorage.setItem("disable_custom_context_menu", "true");
              notify(
                locale === "en"
                  ? "Custom context menu disabled. Please right-click again."
                  : "カスタムコンテキストメニューを無効化しました。もう一度右クリックしてください。"
              );
            } else {
              notify(browserToastLabel);
            }
          }}>
            <ListItemIcon>
              <OpenInBrowserIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={browserLabel}
              slotProps={{ primary: { variant: "body2", color: "text.secondary" } }}
            />
          </MenuItem>,
        ]}
      </Menu>
      <Snackbar
        open={toast !== null}
        autoHideDuration={2500}
        onClose={() => setToast(null)}
        message={toast ?? ""}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </ContextMenuContext.Provider>
  );
}
