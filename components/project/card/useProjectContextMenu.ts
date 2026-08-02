"use client";

import { createElement } from "react";
import DownloadIcon from "@mui/icons-material/Download";
import PersonIcon from "@mui/icons-material/Person";
import { useTranslations } from "next-intl";
import { useContextMenu, useCommonItems } from "@/components/ui/ContextMenu";
import { usePinMenuItem } from "@/components/pin/usePinMenuItem";
import { buildProjectDownloadUrl } from "@/lib/utils/downloadUrl";
import { useDownloadPreference } from "@/lib/hooks/useDownloadPreference";

export interface ProjectContextMenuTarget {
  id: string;
  slug: string;
  title: string;
  authorUsername?: string | null;
}

/** プロジェクトカードの右クリックメニュー（表示・DL・共有・作者・ピン留め）を組み立てる */
export function useProjectContextMenu(project: ProjectContextMenuTarget) {
  const tMenu = useTranslations("ContextMenu");
  const c = useCommonItems();
  const pinItem = usePinMenuItem("project", project.id);
  const href = `/projects/${project.slug}`;
  const downloadUrl = buildProjectDownloadUrl(project.slug, useDownloadPreference());

  return useContextMenu(
    [
      c.open(href, tMenu("viewProject")),
      c.openNewTab(href),
      {
        id: "cm-download",
        label: tMenu("download"),
        icon: createElement(DownloadIcon, { fontSize: "small" }),
        href: downloadUrl,
      },
      { type: "divider" },
      c.copyLink(href),
      c.share(href, project.title),
      ...(project.authorUsername
        ? ([
            { type: "divider" },
            {
              id: "cm-author",
              label: tMenu("author"),
              icon: createElement(PersonIcon, { fontSize: "small" }),
              href: `/profile/${project.authorUsername}`,
            },
          ] as const)
        : []),
      ...(pinItem ? ([{ type: "divider" }, pinItem] as const) : []),
    ],
    // カード全体が LinkCardActionArea（<a>）なのでリンク素通しは無効化
    { passthrough: { links: false } },
  );
}
