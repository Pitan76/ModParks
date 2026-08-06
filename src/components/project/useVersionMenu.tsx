"use client";

import DownloadIcon from "@mui/icons-material/Download";
import { useTranslations } from "next-intl";
import { buildVersionDownloadUrl } from "@/lib/utils/downloadUrl";
import { useCommonItems } from "@/components/ui/ContextMenu";
import type { ContextMenuItem } from "@/components/ui/ContextMenu";

/**
 * バージョン行の右クリックメニュー(開く/DL/リンクコピー)を生成するフックを返す。
 * デスクトップ表とモバイルカードで共通利用する。
 */
export function useVersionMenu(projectSlug: string) {
  const tMenu = useTranslations("ContextMenu");
  const c = useCommonItems();

  return (versionId: string, versionNumber: string): ContextMenuItem[] => {
    const versionUrl = `/projects/${projectSlug}/versions/${versionId}`;
    return [
      c.open(versionUrl, tMenu("open")),
      c.openNewTab(versionUrl),
      { type: "divider" },
      {
        id: "cm-version-download",
        label: tMenu("download"),
        icon: <DownloadIcon fontSize="small" />,
        onClick: () => {
          window.location.href = buildVersionDownloadUrl(versionId);
        },
      },
      c.copyLink(versionUrl),
      c.copyText(versionNumber, `v${versionNumber}`),
    ];
  };
}
