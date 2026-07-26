"use client";

import ProjectVersionsFilters from "./ProjectVersionsFilters";
import ProjectVersionsDesktopTable from "./ProjectVersionsDesktopTable";
import ProjectVersionsMobileList from "./ProjectVersionsMobileList";
import { useProjectVersions } from "./useProjectVersions";
import { useVersionMenu } from "./useVersionMenu";

export type ProjectVersionsTableProps = {
  versions: {
    id:            string;
    versionNumber: string;
    releaseChannel: string;
    mcVersions:    string | string[];
    loaders:       string | string[];
    changelog:     string;
    fileUrl:       string;
    fileName:      string;
    fileSize:      number | null;
    downloads:     number;
    createdAt:     Date | number;
  }[];
  projectSlug: string;
};

/**
 * プロジェクト詳細ページの「バージョン」タブで、リリースバージョン一覧を
 * 絞り込み(チャンネル/ローダー/MC)・並び替え付きで表示するコンポーネント。
 * デスクトップはテーブル、モバイルはカードで表示する。
 */
const ProjectVersionsTable = ({ versions, projectSlug }: ProjectVersionsTableProps) => {
  const state = useProjectVersions(versions);
  const buildMenu = useVersionMenu(projectSlug);

  return (
    <>
      <ProjectVersionsFilters
        filterChannel={state.filterChannel}
        onChannelChange={state.setFilterChannel}
        filterLoader={state.filterLoader}
        onLoaderChange={state.setFilterLoader}
        filterMc={state.filterMc}
        onMcChange={state.setFilterMc}
        loaderOptions={state.loaderOptions}
        mcOptions={state.mcOptions}
      />

      <ProjectVersionsDesktopTable
        versions={state.versions}
        projectSlug={projectSlug}
        order={state.order}
        orderBy={state.orderBy}
        onSort={state.handleSort}
        buildMenu={buildMenu}
      />

      <ProjectVersionsMobileList
        versions={state.versions}
        projectSlug={projectSlug}
        buildMenu={buildMenu}
      />
    </>
  );
};

export default ProjectVersionsTable;
