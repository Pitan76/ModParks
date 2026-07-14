"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import ViewListIcon from "@mui/icons-material/ViewList";
import GridViewIcon from "@mui/icons-material/GridView";
import { useTranslations } from "next-intl";
import ProjectCard, { ProjectCardProps } from "@/components/project/ProjectCard";

type CardLayout = "list" | "grid";

interface ProjectCardListProps {
  projects: ProjectCardProps["project"][];
  /** 表示形式の保存キー。ページごとに独立させたい場合に指定する */
  storageKey?: string;
  defaultLayout?: CardLayout;
}

/** localStorageから表示形式を読み込む。未保存やSSR時はdefaultを返す */
function readStoredLayout(storageKey: string, fallback: CardLayout): CardLayout {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(storageKey);
  return stored === "list" || stored === "grid" ? stored : fallback;
}

/**
 * プロジェクトカード一覧をリスト/グリッドで切り替え表示するコンポーネント。
 * 選択した表示形式はlocalStorageに保存され、次回以降も維持される。
 */
export default function ProjectCardList({
  projects,
  storageKey = "projectCardLayout",
  defaultLayout = "list",
}: ProjectCardListProps) {
  const tCommon = useTranslations("Common");
  const [layout, setLayout] = useState<CardLayout>(defaultLayout);

  useEffect(() => {
    setLayout(readStoredLayout(storageKey, defaultLayout));
  }, [storageKey, defaultLayout]);

  const handleChange = (_: unknown, value: CardLayout | null) => {
    if (!value) return;
    setLayout(value);
    window.localStorage.setItem(storageKey, value);
  };

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <ToggleButtonGroup value={layout} exclusive size="small" onChange={handleChange}>
          <ToggleButton value="list" aria-label={tCommon("view.list")}>
            <Tooltip title={tCommon("view.list")}>
              <ViewListIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="grid" aria-label={tCommon("view.grid")}>
            <Tooltip title={tCommon("view.grid")}>
              <GridViewIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {layout === "grid" ? (
        <Grid container spacing={2}>
          {projects.map((project) => (
            <Grid key={project.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <ProjectCard project={project} layout="grid" />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} layout="list" />
          ))}
        </Box>
      )}
    </>
  );
}
