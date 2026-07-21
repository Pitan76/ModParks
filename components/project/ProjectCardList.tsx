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
import { useColorMode } from "@/components/ThemeRegistry";

type CardLayout = "list" | "grid";

interface ProjectCardListProps {
  projects: ProjectCardProps["project"][];
  /** 表示形式の保存キー。ページごとに独立させたい場合に指定する */
  storageKey?: string;
  defaultLayout?: CardLayout;
  headerLeft?: React.ReactNode;
  headerRight?: React.ReactNode;
  emptyContent?: React.ReactNode;
  footer?: React.ReactNode;
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
  headerLeft,
  headerRight,
  emptyContent,
  footer,
}: ProjectCardListProps) {
  const tCommon = useTranslations("Common");
  const { isNewTheme } = useColorMode();
  const [layout, setLayout] = useState<CardLayout>(defaultLayout);

  useEffect(() => {
    setLayout(readStoredLayout(storageKey, defaultLayout));
  }, [storageKey, defaultLayout]);

  const handleChange = (_: unknown, value: CardLayout | null) => {
    if (!value) return;
    setLayout(value);
    window.localStorage.setItem(storageKey, value);
  };

  const activeLayout = layout;
  const hasHeader = headerLeft || headerRight || projects.length > 0;

  return (
    <Box>
      {hasHeader && (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2, mb: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            {headerLeft}
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, ml: "auto" }}>
            {headerRight}
            {projects.length > 0 && (
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
            )}
          </Box>
        </Box>
      )}

      {projects.length === 0 ? (
        emptyContent
      ) : activeLayout === "grid" ? (
        isNewTheme ? (
          <Box
            sx={{
              display: "grid",
              gap: 3,
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            }}
          >
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} layout="grid" />
            ))}
          </Box>
        ) : (
          <Grid container spacing={2}>
            {projects.map((project) => (
              <Grid key={project.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <ProjectCard project={project} layout="grid" />
              </Grid>
            ))}
          </Grid>
        )
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: isNewTheme ? 3 : 2 }}>
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} layout="list" />
          ))}
        </Box>
      )}

      {footer && <Box sx={{ mt: 3 }}>{footer}</Box>}
    </Box>
  );
}
