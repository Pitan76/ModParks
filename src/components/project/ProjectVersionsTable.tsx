"use client";

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import { useTranslations } from "next-intl";
import ProjectVersionsFilters from "./ProjectVersionsFilters";
import ProjectVersionsDesktopTable from "./ProjectVersionsDesktopTable";
import ProjectVersionsMobileList from "./ProjectVersionsMobileList";
import { useProjectVersions } from "./useProjectVersions";
import { useVersionMenu } from "./useVersionMenu";
import { useColorMode } from "@/components/ThemeRegistry";
import PlainProjectVersionsTable from "@/components/plain/project/PlainProjectVersionsTable";
import { loadMoreProjectVersions } from "@/lib/actions/versionList";

export type ProjectVersionRow = {
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
};

export type ProjectVersionsTableProps = {
  versions: ProjectVersionRow[];
  projectSlug: string;
  /** 公開バージョンの総数。読み込み済みより多ければ続きを取りに行く */
  totalVersions?: number;
};

/**
 * プロジェクト詳細ページの「バージョン」タブで、リリースバージョン一覧を
 * 絞り込み(チャンネル/ローダー/MC)・並び替え付きで表示するコンポーネント。
 * デスクトップはテーブル、モバイルはカードで表示する。
 *
 * 初期表示は 1 ページ分だけで、残りは「さらに読み込む」で継ぎ足す。
 * 絞り込みは読み込み済みの行に対して効くため、件数も併記して取りこぼしを分かるようにしている。
 */
const ProjectVersionsTable = ({ versions, projectSlug, totalVersions }: ProjectVersionsTableProps) => {
  const t = useTranslations("Project.table");
  // サーバから渡る先頭ページはそのまま使い、続きだけを状態に持つ。
  // こうしておくと再取得で先頭ページが差し替わっても、同期用の効果が要らない。
  const [extraRows, setExtraRows] = useState<ProjectVersionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const rows = useMemo(() => {
    const known = new Set(versions.map((v) => v.id));
    return [...versions, ...extraRows.filter((v) => !known.has(v.id))];
  }, [versions, extraRows]);

  const total = totalVersions ?? versions.length;
  const hasMore = !loadFailed && rows.length < total;

  const handleLoadMore = async () => {
    setLoading(true);
    try {
      const more = await loadMoreProjectVersions(projectSlug, rows.length);
      if (more.length === 0) {
        // 取得できるものが無いのに残数だけ残ると押し続けられてしまう
        setLoadFailed(true);
        return;
      }
      setExtraRows((prev) => {
        const known = new Set(prev.map((v) => v.id));
        return [...prev, ...more.filter((v) => !known.has(v.id))];
      });
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const state = useProjectVersions(rows);
  const buildMenu = useVersionMenu(projectSlug);
  const { isPlainTheme } = useColorMode();

  // 全部載っていて絞り込みもかかっていないなら、件数表示はただの雑音になる
  const showFooter = hasMore || state.versions.length !== total;

  const footer = showFooter && (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, mt: 1.5 }}>
      <Typography variant="caption" color="text.secondary">
        {t("shownCount", { shown: state.versions.length, total })}
      </Typography>
      {hasMore && (
        <Button
          size="small"
          onClick={handleLoadMore}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {t("loadMore")}
        </Button>
      )}
    </Box>
  );

  if (isPlainTheme) {
    return (
      <PlainProjectVersionsTable
        versions={state.versions}
        projectSlug={projectSlug}
        filterChannel={state.filterChannel}
        onChannelChange={state.setFilterChannel}
        filterLoader={state.filterLoader}
        onLoaderChange={state.setFilterLoader}
        filterMc={state.filterMc}
        onMcChange={state.setFilterMc}
        loaderOptions={state.loaderOptions}
        mcOptions={state.mcOptions}
        shownCount={state.versions.length}
        totalCount={total}
        hasMore={hasMore}
        loadingMore={loading}
        onLoadMore={handleLoadMore}
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

      {footer}
    </>
  );
};

export default ProjectVersionsTable;
