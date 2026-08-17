"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import {
  batchUpdateIdeaStatus,
  batchUpdateIdeaResolution,
  batchDeleteIdeas,
  batchModifyIdeaMetadata,
} from "@/lib/actions/ideaBatch";

type IdeaForManagement = {
  id: string;
  title: string;
  visibility: string;
  status: string;
  createdAt: Date;
  slug: string;
};

/**
 * 管理画面の複数アイデア一括操作（公開範囲・解決ステータス・削除・メタデータ編集）の
 * 状態とハンドラをまとめたフック。表示（BatchIdeaOperationsClient）から手順を切り離す。
 */
export function useBatchIdeaOperations(ideas: IdeaForManagement[]) {
  const router = useRouter();
  const t = useTranslations("Idea.batch");
  const tIdea = useTranslations("Idea");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [metadataDialogOpen, setMetadataDialogOpen] = useState(false);

  const handleToggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleToggleAll = () => {
    setSelected(selected.size === ideas.length ? new Set() : new Set(ideas.map((i) => i.id)));
  };

  /** 一括操作の共通の外枠。選択解除と再取得までを揃える */
  const runBatch = async (mutate: (ids: string[]) => Promise<void>, errorKey: "statusUpdateError" | "deleteError") => {
    if (selected.size === 0) return;
    setLoading(true);
    setError(null);
    try {
      await mutate(Array.from(selected));
      setSelected(new Set());
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t(errorKey));
    } finally {
      setLoading(false);
    }
  };

  const handleBatchStatus = (status: "public" | "unlisted" | "private" | "draft") =>
    runBatch((ids) => batchUpdateIdeaStatus(ids, status).then(() => undefined), "statusUpdateError");

  const handleBatchResolution = (status: "open" | "in_progress" | "fulfilled") =>
    runBatch((ids) => batchUpdateIdeaResolution(ids, status).then(() => undefined), "statusUpdateError");

  const handleBatchDelete = () =>
    runBatch(async (ids) => {
      await batchDeleteIdeas(ids);
      setDeleteDialogOpen(false);
    }, "deleteError");

  const handleBatchMetadataSubmit = async (
    operation: "add" | "remove" | "set",
    mcVersions: string[],
    loaders: string[],
    tags: string[],
    targets: { mcVersions: boolean; loaders: boolean; tags: boolean }
  ) => {
    if (selected.size === 0) return false;
    setLoading(true);
    setError(null);
    try {
      const res = await batchModifyIdeaMetadata(Array.from(selected), operation, mcVersions, loaders, tags, targets);
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

  const getResolutionLabel = (status: string) => {
    if (status === "open") return tIdea("status.open");
    if (status === "in_progress") return tIdea("status.in_progress");
    return tIdea("status.resolved");
  };

  return {
    selected,
    loading,
    error,
    deleteDialogOpen,
    setDeleteDialogOpen,
    metadataDialogOpen,
    setMetadataDialogOpen,
    handleToggle,
    handleToggleAll,
    handleBatchStatus,
    handleBatchResolution,
    handleBatchDelete,
    handleBatchMetadataSubmit,
    getResolutionLabel,
  };
}
