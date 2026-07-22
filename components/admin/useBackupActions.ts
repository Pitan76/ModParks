import { useState, useTransition, useEffect } from "react";
import type { ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  createBackup,
  deleteBackup,
  restoreBackup,
  restoreBackupFromJson,
  createPreRestoreSnapshot,
  getEncryptionStatus,
  sendBackupToDrive,
  planMergeFromBackup,
  applyMergeFromBackup,
  getBackups
} from "@/lib/actions/adminBackup";
import type { MergePlan } from "@/lib/backup/merge";

type Backup = {
  key: string;
  size: number;
  uploadedAt: string;
};

/**
 * データベースのバックアップ、復元、マージ、およびGoogle Drive連携に関わる
 * 一連の状態管理とビジネスロジックをカプセル化したカスタムフック。
 */
export const useBackupActions = (initialBackups: Backup[]) => {
  const router = useRouter();
  const tAdmin = useTranslations("Admin");

  const [backups, setBackups] = useState<Backup[]>(initialBackups);
  const [isPending, startTransition] = useTransition();

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({
    open: false,
    message: "",
    severity: "success",
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);

  const [localRestoreDialogOpen, setLocalRestoreDialogOpen] = useState(false);
  const [localRestoreContent, setLocalRestoreContent] = useState<string | null>(null);

  const [snapshot, setSnapshot] = useState<{ key: string; downloadUrl: string } | null>(null);
  const [snapshotDownloaded, setSnapshotDownloaded] = useState(false);

  const [totpToken, setTotpToken] = useState("");
  const [confirmPhrase, setConfirmPhrase] = useState("");

  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<string | null>(null);
  const [mergePlan, setMergePlan] = useState<MergePlan | null>(null);

  const [encryptionConfigured, setEncryptionConfigured] = useState<boolean | null>(null);
  const [driveConfigured, setDriveConfigured] = useState(false);

  useEffect(() => {
    getEncryptionStatus()
      .then((res) => {
        setEncryptionConfigured(res.configured);
        setDriveConfigured(res.driveConfigured);
      })
      .catch(() => setEncryptionConfigured(null));
  }, []);

  const showSnackbar = (message: string, severity: "success" | "error") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const refreshBackupList = async () => {
    try {
      const list = await getBackups();
      setBackups(list);
    } catch (e: unknown) {
      showSnackbar(e instanceof Error ? e.message : "Failed to fetch backups", "error");
    }
  };

  const handleCreateBackup = () => {
    startTransition(async () => {
      try {
        const res = await createBackup();
        if (res.success) {
          if (res.driveError) showSnackbar(tAdmin("backup.driveMirrorFailed", { error: res.driveError }), "error");
          else showSnackbar(tAdmin("backup.successCreate"), "success");
          await refreshBackupList();
        }
      } catch (e: unknown) {
        showSnackbar(e instanceof Error ? e.message : "Error creating backup", "error");
      }
    });
  };

  const handleSendToDrive = (key: string) => {
    startTransition(async () => {
      try {
        const res = await sendBackupToDrive(key);
        if (res.success) {
          showSnackbar(tAdmin("backup.driveUploadSuccess"), "success");
          if (res.webViewLink) window.open(res.webViewLink, "_blank");
        } else {
          showSnackbar(tAdmin("backup.driveUploadFailed", { error: res.message }), "error");
        }
      } catch (e: unknown) {
        showSnackbar(tAdmin("backup.driveUploadFailed", { error: e instanceof Error ? e.message : "unknown" }), "error");
      }
    });
  };

  const openDeleteDialog = (key: string) => {
    setDeleteTarget(key);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    setDeleteDialogOpen(false);

    startTransition(async () => {
      try {
        const res = await deleteBackup(deleteTarget);
        if (res.success) {
          showSnackbar(tAdmin("backup.successDelete"), "success");
          await refreshBackupList();
        }
      } catch (e: unknown) {
        showSnackbar(e instanceof Error ? e.message : "Error deleting backup", "error");
      } finally {
        setDeleteTarget(null);
      }
    });
  };

  const actionErrorMessage = (res: any) => {
    if (res?.error === "TWO_FACTOR_REQUIRED") return tAdmin("backup.twoFactorRequired");
    if (res?.error === "INVALID_CODE") return tAdmin("backup.invalidCode");
    return res?.message || "Error";
  };

  const resetSnapshotState = () => {
    setSnapshot(null);
    setSnapshotDownloaded(false);
    setTotpToken("");
    setConfirmPhrase("");
  };

  const handleDownloadCurrentData = () => {
    startTransition(async () => {
      try {
        const res = await createPreRestoreSnapshot();
        setSnapshot({ key: res.key, downloadUrl: res.downloadUrl });
        window.open(res.downloadUrl, "_blank");
        setSnapshotDownloaded(true);
      } catch (e: unknown) {
        showSnackbar(e instanceof Error ? e.message : "Error creating snapshot", "error");
      }
    });
  };

  const openRestoreDialog = (key: string) => {
    resetSnapshotState();
    setRestoreTarget(key);
    setRestoreDialogOpen(true);
  };

  const handleConfirmRestore = () => {
    if (!restoreTarget) return;

    startTransition(async () => {
      try {
        const res = await restoreBackup(restoreTarget, totpToken, snapshot?.key);
        if (res.success) {
          showSnackbar(tAdmin("backup.successRestore"), "success");
          setRestoreDialogOpen(false);
          setRestoreTarget(null);
          resetSnapshotState();
          router.refresh();
        } else {
          showSnackbar(actionErrorMessage(res), "error");
        }
      } catch (e: unknown) {
        showSnackbar(e instanceof Error ? e.message : "Error restoring database", "error");
      }
    });
  };

  const handleDownload = (key: string) => {
    window.open(`/api/admin/backup/download?key=${encodeURIComponent(key)}`, "_blank");
  };

  const handleLocalFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        const parsed = JSON.parse(content);
        if (!parsed.tables || !parsed.version) {
          showSnackbar(tAdmin("backup.invalidFile"), "error");
          return;
        }
        resetSnapshotState();
        setLocalRestoreContent(content);
        setLocalRestoreDialogOpen(true);
      } catch {
        showSnackbar(tAdmin("backup.invalidFile"), "error");
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmLocalRestore = () => {
    if (!localRestoreContent) return;

    startTransition(async () => {
      try {
        const res = await restoreBackupFromJson(localRestoreContent, totpToken, snapshot?.key);
        if (res.success) {
          showSnackbar(tAdmin("backup.successRestore"), "success");
          setLocalRestoreDialogOpen(false);
          setLocalRestoreContent(null);
          resetSnapshotState();
          router.refresh();
        } else {
          showSnackbar(actionErrorMessage(res), "error");
        }
      } catch (e: unknown) {
        showSnackbar(e instanceof Error ? e.message : "Error restoring database", "error");
      }
    });
  };

  const openMergeDialog = (key: string) => {
    resetSnapshotState();
    setMergePlan(null);
    setMergeTarget(key);
    setMergeDialogOpen(true);

    startTransition(async () => {
      try {
        setMergePlan(await planMergeFromBackup(key));
      } catch (e: unknown) {
        showSnackbar(e instanceof Error ? e.message : "Error planning merge", "error");
        setMergeDialogOpen(false);
      }
    });
  };

  const handleConfirmMerge = () => {
    if (!mergeTarget) return;

    startTransition(async () => {
      try {
        const res = await applyMergeFromBackup(mergeTarget, totpToken, snapshot?.key);
        if (res.success) {
          showSnackbar(tAdmin("backup.successMerge"), "success");
          setMergeDialogOpen(false);
          setMergeTarget(null);
          setMergePlan(null);
          resetSnapshotState();
          router.refresh();
        } else {
          showSnackbar(actionErrorMessage(res), "error");
        }
      } catch (e: unknown) {
        showSnackbar(e instanceof Error ? e.message : "Error merging", "error");
      }
    });
  };

  return {
    backups,
    isPending,
    snackbar,
    deleteDialogOpen,
    deleteTarget,
    restoreDialogOpen,
    restoreTarget,
    localRestoreDialogOpen,
    snapshot,
    snapshotDownloaded,
    totpToken,
    confirmPhrase,
    mergeDialogOpen,
    mergeTarget,
    mergePlan,
    encryptionConfigured,
    driveConfigured,
    setDeleteDialogOpen,
    setRestoreDialogOpen,
    setLocalRestoreDialogOpen,
    setMergeDialogOpen,
    setConfirmPhrase,
    setTotpToken,
    handleCloseSnackbar,
    handleCreateBackup,
    handleSendToDrive,
    openDeleteDialog,
    handleConfirmDelete,
    handleDownloadCurrentData,
    openRestoreDialog,
    handleConfirmRestore,
    handleDownload,
    handleLocalFileChange,
    handleConfirmLocalRestore,
    openMergeDialog,
    handleConfirmMerge,
  };
};
