"use client";

import { useMemo, useState } from "react";
import TablePagination from "@mui/material/TablePagination";
import { useTranslations } from "next-intl";
import ProjectVersionsFilters from "./ProjectVersionsFilters";
import ProjectVersionsDesktopTable from "./ProjectVersionsDesktopTable";
import ProjectVersionsMobileList from "./ProjectVersionsMobileList";
import { useProjectVersions } from "./useProjectVersions";
import { useVersionMenu } from "./useVersionMenu";
import { useColorMode } from "@/components/ThemeRegistry";
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

const ROWS_PER_PAGE_OPTIONS = [10, 20, 50, 100];
const DEFAULT_ROWS_PER_PAGE = 20;

/**
 * プロジェクト詳細ページの「バージョン」タブで、リリースバージョン一覧を
 * 絞り込み(チャンネル/ローダー/MC)・並び替え・ページ送り付きで表示するコンポーネント。
 * デスクトップはテーブル、モバイルはカードで表示する。
 *
 * 全バージョンを受け取り、絞り込み・並び替えを適用したうえでページに切り出す。
 * 読み込み済みの分だけを対象にすると、絞り込みの選択肢も件数も実態とずれるため。
 */
const ProjectVersionsTable = ({ versions, projectSlug }: ProjectVersionsTableProps) => {
  const t = useTranslations("Project.table");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);

  const state = useProjectVersions(versions);
  const buildMenu = useVersionMenu(projectSlug);
  const { isPlainTheme } = useColorMode();

  const filteredCount = state.versions.length;
  // 絞り込みで件数が減ったときに空ページへ取り残されないよう、描画時に丸める
  const lastPage = Math.max(0, Math.ceil(filteredCount / rowsPerPage) - 1);
  const safePage = Math.min(page, lastPage);

  const pageRows = useMemo(
    () => state.versions.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage),
    [state.versions, safePage, rowsPerPage],
  );

  const handleChangeRowsPerPage = (value: number) => {
    setRowsPerPage(value);
    setPage(0);
  };

  const pagination = filteredCount > ROWS_PER_PAGE_OPTIONS[0] && (
    <TablePagination
      component="div"
      count={filteredCount}
      page={safePage}
      onPageChange={(_, next) => setPage(next)}
      rowsPerPage={rowsPerPage}
      onRowsPerPageChange={(e) => handleChangeRowsPerPage(Number(e.target.value))}
      rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
      labelRowsPerPage={t("rowsPerPage")}
      labelDisplayedRows={({ from, to, count }) => t("pageRange", { from, to, count })}
      sx={{ mt: 1 }}
    />
  );

  if (isPlainTheme) {
    return (
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
        page={safePage}
        lastPage={lastPage}
        totalCount={filteredCount}
        onPageChange={setPage}
      />
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

      {pagination}
    </>
  );
};

export default ProjectVersionsTable;
