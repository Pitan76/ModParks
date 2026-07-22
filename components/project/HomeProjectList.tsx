"use client";

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import { useColorMode } from "@/components/ThemeRegistry";
import ProjectCard from "@/components/project/ProjectCard";
import type { ProjectCardProps } from "@/components/project/ProjectCard";

type HomeProjectListProps = {
  projects: ProjectCardProps["project"][];
};

/**
 * ホームページ用のプロジェクト一覧表示コンポーネント。
 * 新テーマ時は3列グリッドではなく、リスト（縦並び）で表示する。
 */
const HomeProjectList = ({ projects }: HomeProjectListProps) => {
  const { isNewTheme } = useColorMode();

  return (
    <Grid container spacing={isNewTheme ? 0 : 2}>
      {projects.map((project) => (
        <Grid key={project.id} size={{ xs: 12, sm: 6, md: 4 }}>
          <ProjectCard project={project} layout="grid" />
        </Grid>
      ))}
    </Grid>
  );
};

export default HomeProjectList;
