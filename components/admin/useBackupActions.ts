import type { ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createBackup,
  deleteBackup,
  restoreBackup,
  restoreBackupFromJson,
  createPreRestoreSnapshot,
  sendBackupToDrive,
  applyMergeFromBackup,
} from "@/lib/actions/adminBackup";
import { planMergeFromBackup } from "@/lib/actions/adminBackupQuery";
import { useBackupState, type Backup } from "./useBackupState";

/**
 * データベースのバックアップ、復元、マージ、Google Drive連携に関わる
 * ビジネスロジックを状態層(useBackupState)の上に組み立てるフック。
 */
export const useBackupActions = (initialBackups: Backup[]) => {
  const router = useRouter();
  const s = useBackupState(initialBackups);
  const { tAdmin, startTransition, showSnackbar, resetSnapshotState, refreshBackupList, actionErrorMessage } = s;

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
    s.setDeleteTarget(key);
    s.setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!s.deleteTarget) return;
    s.setDeleteDialogOpen(false);
    startTransition(async () => {
      try {
        const res = await deleteBackup(s.deleteTarget!);
        if (res.success) {
          showSnackbar(tAdmin("backup.successDelete"), "success");
          await refreshBackupList();
        }
      } catch (e: unknown) {
        showSnackbar(e instanceof Error ? e.message : "Error deleting backup", "error");
      } finally {
        s.setDeleteTarget(null);
      }
    });
  };

  const handleDownloadCurrentData = () => {
    startTransition(async () => {
      try {
        const res = await createPreRestoreSnapshot();
        s.setSnapshot({ key: res.key, downloadUrl: res.downloadUrl });
        window.open(res.downloadUrl, "_blank");
        s.setSnapshotDownloaded(true);
      } catch (e: unknown) {
        showSnackbar(e instanceof Error ? e.message : "Error creating snapshot", "error");
      }
    });
  };

  const openRestoreDialog = (key: string) => {
    resetSnapshotState();
    s.setRestoreTarget(key);
    s.setRestoreDialogOpen(true);
  };

  const handleConfirmRestore = () => {
    if (!s.restoreTarget) return;
    startTransition(async () => {
      try {
        const res = await restoreBackup(s.restoreTarget!, s.totpToken, s.snapshot?.key);
        if (res.success) {
          showSnackbar(tAdmin("backup.successRestore"), "success");
          s.setRestoreDialogOpen(false);
          s.setRestoreTarget(null);
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
        s.setLocalRestoreContent(content);
        s.setLocalRestoreDialogOpen(true);
      } catch {
        showSnackbar(tAdmin("backup.invalidFile"), "error");
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmLocalRestore = () => {
    if (!s.localRestoreContent) return;
    startTransition(async () => {
      try {
        const res = await restoreBackupFromJson(s.localRestoreContent!, s.totpToken, s.snapshot?.key);
        if (res.success) {
          showSnackbar(tAdmin("backup.successRestore"), "success");
          s.setLocalRestoreDialogOpen(false);
          s.setLocalRestoreContent(null);
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
    s.setMergePlan(null);
    s.setMergeTarget(key);
    s.setMergeDialogOpen(true);
    startTransition(async () => {
      try {
        s.setMergePlan(await planMergeFromBackup(key));
      } catch (e: unknown) {
        showSnackbar(e instanceof Error ? e.message : "Error planning merge", "error");
        s.setMergeDialogOpen(false);
      }
    });
  };

  const handleConfirmMerge = () => {
    if (!s.mergeTarget) return;
    startTransition(async () => {
      try {
        const res = await applyMergeFromBackup(s.mergeTarget!, s.totpToken, s.snapshot?.key);
        if (res.success) {
          showSnackbar(tAdmin("backup.successMerge"), "success");
          s.setMergeDialogOpen(false);
          s.setMergeTarget(null);
          s.setMergePlan(null);
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
    backups: s.backups,
    isPending: s.isPending,
    snackbar: s.snackbar,
    deleteDialogOpen: s.deleteDialogOpen,
    deleteTarget: s.deleteTarget,
    restoreDialogOpen: s.restoreDialogOpen,
    restoreTarget: s.restoreTarget,
    localRestoreDialogOpen: s.localRestoreDialogOpen,
    snapshot: s.snapshot,
    snapshotDownloaded: s.snapshotDownloaded,
    totpToken: s.totpToken,
    confirmPhrase: s.confirmPhrase,
    mergeDialogOpen: s.mergeDialogOpen,
    mergeTarget: s.mergeTarget,
    mergePlan: s.mergePlan,
    encryptionConfigured: s.encryptionConfigured,
    driveConfigured: s.driveConfigured,
    setDeleteDialogOpen: s.setDeleteDialogOpen,
    setRestoreDialogOpen: s.setRestoreDialogOpen,
    setLocalRestoreDialogOpen: s.setLocalRestoreDialogOpen,
    setMergeDialogOpen: s.setMergeDialogOpen,
    setConfirmPhrase: s.setConfirmPhrase,
    setTotpToken: s.setTotpToken,
    handleCloseSnackbar: s.handleCloseSnackbar,
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
