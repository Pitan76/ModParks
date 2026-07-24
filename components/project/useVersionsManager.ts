"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { deleteVersion, setVersionArchived } from "@/lib/actions/version";
import { extractRecipesFromVersion } from "@/lib/actions/versionRecipe";
import { importGithubRelease } from "@/lib/actions/github";
import { normalizeReleaseChannel } from "@/lib/releaseChannels";

export type ProjectVersion = {
  id: string;
  versionNumber: string;
  mcVersions: string;
  loaders: string;
  createdAt: Date;
  downloads: number;
  changelog: string;
  releaseChannel: string;
  fileUrl: string;
  archivedAt?: Date | null;
  isExternal?: boolean;
  canExtractRecipes?: boolean;
};

type ImportMsg = { text: string; severity: "success" | "error" } | null;

export function useVersionsManager(projectSlug: string, initialVersions: ProjectVersion[]) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("Version");

  const [localVersions, setLocalVersions] = useState(initialVersions);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<ProjectVersion | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<ImportMsg>(null);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const parsedVersions = useMemo(() => {
    return localVersions.map((v) => {
      let mcvs: string[] = [];
      try {
        mcvs = JSON.parse(v.mcVersions) as string[];
      } catch {}
      return { ...v, releaseChannel: normalizeReleaseChannel(v.releaseChannel), parsedMcVersions: mcvs, date: new Date(v.createdAt) };
    });
  }, [localVersions]);

  useEffect(() => {
    if (!searchParams) return;
    const editId = searchParams.get("editVersionId");
    if (!editId) return;
    const targetVersion = localVersions.find((v) => v.id === editId);
    if (!targetVersion) return;
    setEditTarget(targetVersion);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("editVersionId");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, localVersions, pathname, router]);

  const handleImportGithub = async () => {
    setImporting(true);
    setImportMsg(null);
    try {
      const res = await importGithubRelease(projectSlug);
      if ("error" in res) {
        setImportMsg({ text: res.error, severity: "error" });
      } else {
        setImportMsg({ text: t("manager.importSuccess", { version: res.versionNumber }), severity: "success" });
        router.refresh();
      }
    } catch (err: unknown) {
      setImportMsg({ text: err instanceof Error ? err.message : t("manager.importError"), severity: "error" });
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setPending(true);
    setErrorMsg("");
    try {
      const res = await deleteVersion(deleteId, projectSlug);
      if ("error" in res) {
        setErrorMsg(res.error || "Failed to delete version");
      } else {
        setLocalVersions((prev) => prev.filter((v) => v.id !== deleteId));
        setDeleteId(null);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to delete version");
    } finally {
      setPending(false);
    }
  };

  const handleExtractRecipes = async (versionId: string) => {
    setExtractingId(versionId);
    setErrorMsg("");
    setImportMsg(null);
    try {
      const res = await extractRecipesFromVersion(versionId, projectSlug);
      if ("error" in res) setErrorMsg(res.error || "Failed to extract recipes");
      else setImportMsg({ text: t("manager.extractSuccess", { count: res.count }), severity: "success" });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to extract recipes");
    } finally {
      setExtractingId(null);
    }
  };

  const handleToggleArchive = async (v: ProjectVersion) => {
    const nextArchived = !v.archivedAt;
    setArchivingId(v.id);
    setErrorMsg("");
    try {
      const res = await setVersionArchived(v.id, projectSlug, nextArchived);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setLocalVersions((prev) =>
          prev.map((item) => (item.id === v.id ? { ...item, archivedAt: nextArchived ? new Date() : null } : item))
        );
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to archive version");
    } finally {
      setArchivingId(null);
    }
  };

  const handleEditSuccess = (updated: ProjectVersion) => {
    setLocalVersions((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
  };

  return {
    localVersions,
    parsedVersions,
    deleteId,
    setDeleteId,
    editTarget,
    setEditTarget,
    uploadOpen,
    setUploadOpen,
    pending,
    errorMsg,
    importing,
    importMsg,
    setImportMsg,
    extractingId,
    archivingId,
    handleImportGithub,
    handleDelete,
    handleExtractRecipes,
    handleToggleArchive,
    handleEditSuccess,
  };
}

export type ParsedVersion = ReturnType<typeof useVersionsManager>["parsedVersions"][number];
