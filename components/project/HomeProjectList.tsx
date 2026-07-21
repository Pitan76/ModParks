"use client";

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import { useColorMode } from "@/components/ThemeRegistry";
import ProjectCard, { ProjectCardProps } from "@/components/project/ProjectCard";

interface HomeProjectListProps {
  projects: ProjectCardProps["project"][];
}

/**
 * ホームページ用のプロジェクト一覧表示コンポーネント。
 * 新テーマ時は3列グリッドではなく、リスト（縦並び）で表示する。
 */
export default function HomeProjectList({ projects }: HomeProjectListProps) {
  const { isNewTheme } = useColorMode();

  if (isNewTheme) {
    return (
      <Box
        sx={{
          display: "grid",
          gap: 0,
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        }}
      >
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} layout="grid" />
        ))}
      </Box>
    );
  }

  return (
    <Grid container spacing={2}>
      {projects.map((project) => (
        <Grid key={project.id} size={{ xs: 12, sm: 6, md: 4 }}>
          <ProjectCard project={project} layout="grid" />
        </Grid>
      ))}
    </Grid>
  );
}
