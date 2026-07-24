import { useState, useTransition, useEffect } from "react";
import { useTranslations } from "next-intl";
import { getEncryptionStatus, getBackups } from "@/lib/actions/adminBackupQuery";
import type { MergePlan } from "@/lib/backup/merge";

export type Backup = {
  key: string;
  size: number;
  uploadedAt: string;
};

type Severity = "success" | "error";

/** バックアップ管理画面の状態・スナックバー・派生操作を保持する状態層フック。 */
export function useBackupState(initialBackups: Backup[]) {
  const tAdmin = useTranslations("Admin");

  const [backups, setBackups] = useState<Backup[]>(initialBackups);
  const [isPending, startTransition] = useTransition();

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: Severity }>({
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

  const showSnackbar = (message: string, severity: Severity) => setSnackbar({ open: true, message, severity });
  const handleCloseSnackbar = () => setSnackbar((prev) => ({ ...prev, open: false }));

  const resetSnapshotState = () => {
    setSnapshot(null);
    setSnapshotDownloaded(false);
    setTotpToken("");
    setConfirmPhrase("");
  };

  const refreshBackupList = async () => {
    try {
      setBackups(await getBackups());
    } catch (e: unknown) {
      showSnackbar(e instanceof Error ? e.message : "Failed to fetch backups", "error");
    }
  };

  const actionErrorMessage = (res: any) => {
    if (res?.error === "TWO_FACTOR_REQUIRED") return tAdmin("backup.twoFactorRequired");
    if (res?.error === "INVALID_CODE") return tAdmin("backup.invalidCode");
    return res?.message || "Error";
  };

  return {
    tAdmin,
    backups,
    isPending,
    startTransition,
    snackbar,
    deleteDialogOpen,
    setDeleteDialogOpen,
    deleteTarget,
    setDeleteTarget,
    restoreDialogOpen,
    setRestoreDialogOpen,
    restoreTarget,
    setRestoreTarget,
    localRestoreDialogOpen,
    setLocalRestoreDialogOpen,
    localRestoreContent,
    setLocalRestoreContent,
    snapshot,
    setSnapshot,
    snapshotDownloaded,
    setSnapshotDownloaded,
    totpToken,
    setTotpToken,
    confirmPhrase,
    setConfirmPhrase,
    mergeDialogOpen,
    setMergeDialogOpen,
    mergeTarget,
    setMergeTarget,
    mergePlan,
    setMergePlan,
    encryptionConfigured,
    driveConfigured,
    showSnackbar,
    handleCloseSnackbar,
    resetSnapshotState,
    refreshBackupList,
    actionErrorMessage,
  };
}
