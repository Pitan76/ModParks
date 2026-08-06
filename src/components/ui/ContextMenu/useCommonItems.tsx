"use client";

import * as React from "react";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import LinkIcon from "@mui/icons-material/Link";
import ShareIcon from "@mui/icons-material/Share";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import LaunchIcon from "@mui/icons-material/Launch";
import { useTranslations } from "next-intl";
import { useContextMenuContext } from "./ContextMenuProvider";
import type { ContextMenuActionItem } from "./types";

/** 絶対URLに整える（相対パスならオリジンを補う） */
function absolute(url: string): string {
  if (typeof window === "undefined") return url;
  try {
    return new URL(url, window.location.origin).toString();
  } catch {
    return url;
  }
}

/**
 * どのカードでも使い回す共通メニュー項目（開く/新規タブ/リンクコピー/共有 …）を
 * i18n・通知に紐付けて生成するビルダー群を返す。
 *
 * @example
 * const c = useCommonItems();
 * const onContextMenu = useContextMenu([
 *   c.open(`/projects/${slug}`),
 *   c.openNewTab(`/projects/${slug}`),
 *   { type: "divider" },
 *   c.copyLink(`/projects/${slug}`),
 *   c.share(`/projects/${slug}`, name),
 * ], { passthrough: { links: false } });
 */
export function useCommonItems() {
  const t = useTranslations("ContextMenu");
  const { notify } = useContextMenuContext();

  return React.useMemo(() => {
    const copy = async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        notify(t("copied"));
      } catch {
        /* クリップボード不可の環境は黙ってスキップ */
      }
    };

    return {
      /** 内部遷移で開く */
      open(href: string, label?: string): ContextMenuActionItem {
        return { id: "cm-open", label: label ?? t("open"), icon: <LaunchIcon fontSize="small" />, href };
      },
      /** 新しいタブで開く */
      openNewTab(url: string): ContextMenuActionItem {
        return {
          id: "cm-open-new-tab",
          label: t("openNewTab"),
          icon: <OpenInNewIcon fontSize="small" />,
          onClick: () => window.open(absolute(url), "_blank", "noopener"),
        };
      },
      /** リンク（絶対URL）をコピー */
      copyLink(url: string): ContextMenuActionItem {
        return {
          id: "cm-copy-link",
          label: t("copyLink"),
          icon: <LinkIcon fontSize="small" />,
          onClick: () => copy(absolute(url)),
        };
      },
      /** 任意テキストをコピー */
      copyText(text: string, label?: string): ContextMenuActionItem {
        return {
          id: "cm-copy-text",
          label: label ?? t("copyText"),
          icon: <ContentCopyIcon fontSize="small" />,
          onClick: () => copy(text),
        };
      },
      /** Web Share API（無ければリンクコピーにフォールバック） */
      share(url: string, title?: string): ContextMenuActionItem {
        return {
          id: "cm-share",
          label: t("share"),
          icon: <ShareIcon fontSize="small" />,
          onClick: async () => {
            const shareUrl = absolute(url);
            if (typeof navigator !== "undefined" && navigator.share) {
              try {
                await navigator.share({ title, url: shareUrl });
                return;
              } catch {
                /* キャンセル時は何もしない */
                return;
              }
            }
            await copy(shareUrl);
          },
        };
      },
    };
  }, [t, notify]);
}
