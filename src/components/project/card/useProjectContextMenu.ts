"use client";

import { createElement } from "react";
import DownloadIcon from "@mui/icons-material/Download";
import PersonIcon from "@mui/icons-material/Person";
import { useTranslations } from "next-intl";
import { useContextMenu, useCommonItems } from "@/components/ui/ContextMenu";
import { usePinMenuItem } from "@/components/pin/usePinMenuItem";
import { buildProjectDownloadUrl } from "@modparks/core/utils/downloadUrl";
import { useDownloadPreference } from "@/lib/hooks/useDownloadPreference";
import { useCartMenuItems } from "./useCartMenuItems";

export interface ProjectContextMenuTarget {
  id: string;
  slug: string;
  title: string;
  authorUsername?: string | null;
  /** カート項目を出すために要る。無ければカート操作は出さない */
  iconUrl?: string | null;
  type?: string;
}

/** プロジェクトカードの右クリックメニュー（表示・DL・共有・作者・カート・ピン留め）を組み立てる */
export function useProjectContextMenu(project: ProjectContextMenuTarget) {
  const tMenu = useTranslations("ContextMenu");
  const c = useCommonItems();
  const pinItem = usePinMenuItem("project", project.id);
  const href = `/projects/${project.slug}`;
  const downloadUrl = buildProjectDownloadUrl(project.slug, useDownloadPreference());
  const cartItems = useCartMenuItems(
    project.type
      ? { id: project.id, slug: project.slug, title: project.title, iconUrl: project.iconUrl ?? null, type: project.type }
      : null,
  );

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
      ...cartItems,
      ...(pinItem ? ([{ type: "divider" }, pinItem] as const) : []),
    ],
    // カード全体が LinkCardActionArea（<a>）なのでリンク素通しは無効化
    { passthrough: { links: false } },
  );
}
