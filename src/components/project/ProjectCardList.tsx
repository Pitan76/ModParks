"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import ViewListIcon from "@mui/icons-material/ViewList";
import GridViewIcon from "@mui/icons-material/GridView";
import { useTranslations } from "next-intl";
import ProjectCard from "@/components/project/ProjectCard";
import type { ProjectCardProps } from "@/components/project/ProjectCard";
import { useColorMode } from "@/components/ThemeRegistry";
import PlainProjectCardList from "@/components/plain/project/PlainProjectCardList";
import CardGrid from "@/components/ui/CardGrid";

type CardLayout = "list" | "grid";

type ProjectCardListProps = {
  projects: ProjectCardProps["project"][];
  /** 表示形式の保存キー。ページごとに独立させたい場合に指定する */
  storageKey?: string;
  defaultLayout?: CardLayout;
  headerLeft?: ReactNode;
  headerRight?: ReactNode;
  emptyContent?: ReactNode;
  footer?: ReactNode;
};

const readStoredLayout = (storageKey: string, fallback: CardLayout): CardLayout => {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(storageKey);
  return stored === "list" || stored === "grid" ? stored : fallback;
};

/**
 * プロジェクトカード一覧をリスト/グリッドで切り替え表示するコンポーネント。
 * 選択した表示形式はlocalStorageに保存され、次回以降も維持される。
 */
const ProjectCardList = ({
  projects,
  storageKey = "projectCardLayout",
  defaultLayout = "list",
  headerLeft,
  headerRight,
  emptyContent,
  footer,
}: ProjectCardListProps) => {
  const tCommon = useTranslations("Common");
  const { isNewTheme, isPlainTheme } = useColorMode();
  const [layout, setLayout] = useState<CardLayout>(defaultLayout);

  useEffect(() => {
    setLayout(readStoredLayout(storageKey, defaultLayout));
  }, [storageKey, defaultLayout]);

  const applyLayout = (value: CardLayout) => {
    setLayout(value);
    window.localStorage.setItem(storageKey, value);
  };

  const handleChange = (_: unknown, value: CardLayout | null) => {
    if (!value) return;
    applyLayout(value);
  };

  const activeLayout = layout;

  if (isPlainTheme) {
    return (
      <PlainProjectCardList
        projects={projects}
        headerLeft={headerLeft}
        headerRight={headerRight}
        emptyContent={emptyContent}
        footer={footer}
      />
    );
  }
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
        <CardGrid gap={isNewTheme ? 0 : 2}>
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} layout="grid" />
          ))}
        </CardGrid>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: isNewTheme ? 0 : 2 }}>
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} layout="list" />
          ))}
        </Box>
      )}

      {footer && <Box sx={{ mt: 3 }}>{footer}</Box>}
    </Box>
  );
};

export default ProjectCardList;
