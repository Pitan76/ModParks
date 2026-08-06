"use client";

import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { DownloadLabel, DateLabel } from "@/components/ui/ProjectInfoLabels";
import ProjectTagList from "./ProjectTagList";

export type ProjectCardMetaProps = {
  downloads: number;
  totalDownloads: number;
  externalDownloads?: Record<string, number> | null;
  modrinthId?: string | null;
  curseforgeId?: string | null;
  updatedAt: Date | number;
  tags: string[];
  isGrid: boolean;
  /** リスト表示ではこの行に置く。グリッドではカード右上に浮かせるので渡さない */
  cartButton?: ReactNode;
};

/** カード下部のメタ情報（ダウンロード数・更新日・タグ）をレイアウトごとに出し分ける */
const ProjectCardMeta = ({
  downloads,
  totalDownloads,
  externalDownloads,
  modrinthId,
  curseforgeId,
  updatedAt,
  tags,
  isGrid,
  cartButton,
}: ProjectCardMetaProps) => (
  <Box
    sx={{
      display: "flex",
      flexDirection: isGrid ? "row" : { xs: "row", sm: "column" },
      alignItems: isGrid ? "center" : { xs: "center", sm: "flex-end" },
      justifyContent: isGrid ? "space-between" : "flex-start",
      width: isGrid ? "100%" : { xs: "100%", sm: "auto" },
      gap: isGrid ? 2 : { xs: 2, sm: 0.5 },
      flexShrink: 0,
      mt: isGrid ? "auto" : { xs: "auto", sm: 0 },
      alignSelf: isGrid ? "auto" : { xs: "stretch", sm: "flex-end" },
    }}
  >
    {/* グリッド/狭い画面は左右に振り分け、リスト表示(sm以上)は右寄せで列幅を広げない */}
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: isGrid ? "space-between" : { xs: "space-between", sm: "flex-end" },
        width: isGrid ? "auto" : { xs: "100%", sm: "auto" },
        flex: isGrid ? "1 1 auto" : "0 1 auto",
        gap: isGrid ? 2 : { xs: 2, sm: 1 },
        minWidth: 0,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", minWidth: 0 }}>
        <DownloadLabel
          downloads={downloads}
          totalDownloads={totalDownloads}
          externalDownloads={externalDownloads}
          modrinthId={modrinthId}
          curseforgeId={curseforgeId}
          iconSize="1rem"
          textVariant="body2"
          textColor="text.secondary"
          iconColor="text.secondary"
        />
        {/* 狭い画面・グリッド表示ではDL数の横に日付を置く */}
        <Box
          sx={{
            display: isGrid ? "flex" : { xs: "flex", sm: "none" },
            alignItems: "center",
            gap: 0.5,
            minWidth: 0,
          }}
        >
          <Typography variant="caption" color="text.disabled">•</Typography>
          <DateLabel date={updatedAt} type="updated" textVariant="caption" textColor="text.disabled" hideIcon />
        </Box>
      </Box>

      {cartButton}
    </Box>

    <ProjectTagList
      tags={tags}
      visibleCount={isGrid ? 2 : 3}
      marginTop={isGrid ? 0 : { xs: 0, sm: 1 }}
    />
  </Box>
);

export default ProjectCardMeta;
