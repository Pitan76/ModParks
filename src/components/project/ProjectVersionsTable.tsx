"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import ProjectVersionsFilters from "./ProjectVersionsFilters";
import ProjectVersionsDesktopTable from "./ProjectVersionsDesktopTable";
import ProjectVersionsMobileList from "./ProjectVersionsMobileList";
import { useProjectVersions } from "./useProjectVersions";
import { useVersionMenu } from "./useVersionMenu";
import { useColorMode } from "@/components/ThemeRegistry";
import PaginationControls from "@/components/ui/PaginationControls";
import PlainProjectVersionsTable from "@/components/plain/project/PlainProjectVersionsTable";

export type ProjectVersionRow = {
  id:            string;
  versionNumber: string;
  releaseChannel: string;
  mcVersions:    string | string[];
  loaders:       string | string[];
  changelog:     string;
  fileSize:      number | null;
  downloads:     number;
  createdAt:     Date | number;
};

export type ProjectVersionsTableProps = {
  versions: ProjectVersionRow[];
  projectSlug: string;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** URL の数値パラメータを読む。壊れた値でも一覧が出せるよう既定値へ倒す */
const readNumberParam = (value: string | null | undefined, fallback: number, max: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.trunc(parsed), max);
};

/**
 * プロジェクト詳細ページの「バージョン」タブで、リリースバージョン一覧を
 * 絞り込み(チャンネル/ローダー/MC)・並び替え・ページ送り付きで表示するコンポーネント。
 * デスクトップはテーブル、モバイルはカードで表示する。
 *
 * 全バージョンを受け取り、絞り込み・並び替えを適用したうえでページに切り出す。
 * 読み込み済みの分だけを対象にすると、絞り込みの選択肢も件数も実態とずれるため。
 * ページと表示件数はサイト共通の PaginationControls に合わせて URL で持つ。
 */
const ProjectVersionsTable = ({ versions, projectSlug }: ProjectVersionsTableProps) => {
  const searchParams = useSearchParams();
  const limit = readNumberParam(searchParams?.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
  const requestedPage = readNumberParam(searchParams?.get("page"), 1, Number.MAX_SAFE_INTEGER);

  const state = useProjectVersions(versions);
  const buildMenu = useVersionMenu(projectSlug);
  const { isPlainTheme } = useColorMode();

  const filteredCount = state.versions.length;
  // 絞り込みで件数が減ったときに空ページへ取り残されないよう、描画時に丸める
  const lastPage = Math.max(1, Math.ceil(filteredCount / limit));
  const page = Math.min(requestedPage, lastPage);

  const pageRows = useMemo(
    () => state.versions.slice((page - 1) * limit, page * limit),
    [state.versions, page, limit],
  );

  const pager = filteredCount > limit && (
    <PaginationControls totalCount={filteredCount} currentPage={page} currentLimit={limit} sx={{ mt: 2 }} />
  );

  if (isPlainTheme) {
    return (
      <>
        <PlainProjectVersionsTable
          versions={pageRows}
          projectSlug={projectSlug}
          filterChannel={state.filterChannel}
          onChannelChange={state.setFilterChannel}
          filterLoader={state.filterLoader}
          onLoaderChange={state.setFilterLoader}
          filterMc={state.filterMc}
          onMcChange={state.setFilterMc}
          loaderOptions={state.loaderOptions}
          mcOptions={state.mcOptions}
        />
        {pager}
      </>
    );
  }

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
        versions={pageRows}
        projectSlug={projectSlug}
        order={state.order}
        orderBy={state.orderBy}
        onSort={state.handleSort}
        buildMenu={buildMenu}
      />

      <ProjectVersionsMobileList
        versions={pageRows}
        projectSlug={projectSlug}
        buildMenu={buildMenu}
      />

      {pager}
    </>
  );
};

export default ProjectVersionsTable;
