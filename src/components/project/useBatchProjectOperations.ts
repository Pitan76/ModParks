"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { batchUpdateProjectStatus, batchDeleteProjects } from "@/lib/actions/projectBatch";
import { batchModifyProjectMcVersions } from "@/lib/actions/projectBatchMcVersion";
import { batchUpdateProjectSettings, type BatchProjectSettingsUpdates } from "@/lib/actions/projectBatchSettings";

type ProjectForManagement = {
  id: string;
  slug: string;
  title: string;
  type: string;
  visibility: string;
  downloads: number | null;
  totalDownloads: number | null;
  githubRepo?: string | null;
  latestVersionNumber?: string | null;
};

/**
 * 管理画面の複数プロジェクト一括操作（ステータス変更・削除・MCバージョン編集・設定変更）の
 * 状態とハンドラをまとめたフック。表示（BatchProjectOperationsClient）から手順を切り離す。
 */
export function useBatchProjectOperations(projects: ProjectForManagement[]) {
  const router = useRouter();
  const t = useTranslations("Project.batch");
  const tCommon = useTranslations("Common");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mcVersionDialogOpen, setMcVersionDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  const handleToggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleToggleAll = () => {
    setSelected(selected.size === projects.length ? new Set() : new Set(projects.map((p) => p.id)));
  };

  const handleBatchStatus = async (status: "public" | "unlisted" | "private" | "draft") => {
    if (selected.size === 0) return;

    setLoading(true);
    setError(null);
    try {
      await batchUpdateProjectStatus(Array.from(selected), status);
      setSelected(new Set());
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("statusUpdateError"));
    } finally {
      setLoading(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selected.size === 0) return;

    setLoading(true);
    setError(null);
    try {
      await batchDeleteProjects(Array.from(selected));
      setSelected(new Set());
      setDeleteDialogOpen(false);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("deleteError"));
    } finally {
      setLoading(false);
    }
  };

  const handleBatchMcVersions = async (
    operation: "add" | "remove" | "set",
    mcVersions: string[],
    targetVersions: "all" | "latest",
    platforms: { modparks: boolean; modrinth: boolean }
  ) => {
    if (selected.size === 0) return false;
    setLoading(true);
    setError(null);
    try {
      const res = await batchModifyProjectMcVersions(Array.from(selected), operation, mcVersions, targetVersions, platforms);
      if (res && "error" in res) {
        setError(res.error || t("statusUpdateError"));
        return false;
      }
      setSelected(new Set());
      router.refresh();
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("statusUpdateError"));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleBatchSettings = async (updates: BatchProjectSettingsUpdates) => {
    if (selected.size === 0) return false;
    setLoading(true);
    setError(null);
    try {
      const res = await batchUpdateProjectSettings(Array.from(selected), updates);
      if (res && "error" in res) {
        setError(res.error || t("statusUpdateError"));
        return false;
      }
      setSelected(new Set());
      router.refresh();
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("statusUpdateError"));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: string) => {
    if (tCommon.has(`visibility.${status}` as never)) return tCommon(`visibility.${status}` as never);
    return status;
  };

  return {
    selected,
    loading,
    error,
    deleteDialogOpen,
    setDeleteDialogOpen,
    mcVersionDialogOpen,
    setMcVersionDialogOpen,
    settingsDialogOpen,
    setSettingsDialogOpen,
    handleToggle,
    handleToggleAll,
    handleBatchStatus,
    handleBatchDelete,
    handleBatchMcVersions,
    handleBatchSettings,
    getStatusLabel,
  };
}
