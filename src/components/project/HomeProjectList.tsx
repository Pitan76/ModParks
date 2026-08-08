"use client";

import { useColorMode } from "@/components/ThemeRegistry";
import CardGrid from "@/components/ui/CardGrid";
import ProjectCard from "@/components/project/ProjectCard";
import type { ProjectCardProps } from "@/components/project/ProjectCard";
import PlainProjectTable from "@/components/plain/project/PlainProjectTable";

type HomeProjectListProps = {
  projects: ProjectCardProps["project"][];
};

/**
 * ホームページ用のプロジェクト一覧表示コンポーネント。
 * 新テーマ時は3列グリッドではなく、リスト（縦並び）で表示する。
 */
const HomeProjectList = ({ projects }: HomeProjectListProps) => {
  const { isNewTheme, isPlainTheme } = useColorMode();

  if (isPlainTheme) return <PlainProjectTable projects={projects} />;

  return (
    <CardGrid gap={isNewTheme ? 0 : 2}>
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} layout="grid" showCart={false} />
      ))}
    </CardGrid>
  );
};

export default HomeProjectList;
