"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import TextField from "@mui/material/TextField";
import Snackbar from "@mui/material/Snackbar";
import Backdrop from "@mui/material/Backdrop";
import AddIcon from "@mui/icons-material/Add";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DownloadIcon from "@mui/icons-material/Download";
import RestoreIcon from "@mui/icons-material/SettingsBackupRestore";
import MergeIcon from "@mui/icons-material/CallMerge";
import AddToDriveIcon from "@mui/icons-material/AddToDrive";
import DeleteIcon from "@mui/icons-material/Delete";
import Chip from "@mui/material/Chip";
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

interface Backup {
  key: string;
  size: number;
  uploadedAt: string;
}

interface BackupClientProps {
  initialBackups: Backup[];
  locale: string;
}

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export default function BackupClient({ initialBackups, locale }: BackupClientProps) {
  const router = useRouter();
  const tAdmin = useTranslations("Admin");
  // cancel / delete は Admin ではなく Common 名前空間にある
  const tCommon = useTranslations("Common");
  const [backups, setBackups] = useState<Backup[]>(initialBackups);
  const [isPending, startTransition] = useTransition();

  // 通知（Snackbar）用の状態
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({
    open: false,
    message: "",
    severity: "success",
  });

  // 各種確認ダイアログの状態
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);

  const [localRestoreDialogOpen, setLocalRestoreDialogOpen] = useState(false);
  const [localRestoreContent, setLocalRestoreContent] = useState<string | null>(null);

  // 復元前に取得する切り戻し用スナップショット。
  // 復元は全データを置き換えるため、実行前に必ず手元へ退避させます。
  const [snapshot, setSnapshot] = useState<{ key: string; downloadUrl: string } | null>(null);
  const [snapshotDownloaded, setSnapshotDownloaded] = useState(false);

  // 誤操作防止。復元には TOTP による再認証と、確認フレーズの入力の両方を要求します。
  const [totpToken, setTotpToken] = useState("");
  const [confirmPhrase, setConfirmPhrase] = useState("");

  const RESTORE_CONFIRM_PHRASE = "RESTORE";
  const MERGE_CONFIRM_PHRASE = "MERGE";

  // マージ用の状態。試算 (plan) を表示してから適用する 2 段構え。
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<string | null>(null);
  const [mergePlan, setMergePlan] = useState<MergePlan | null>(null);

  const activePhrase = mergeDialogOpen ? MERGE_CONFIRM_PHRASE : RESTORE_CONFIRM_PHRASE;

  const canRestore =
    snapshotDownloaded &&
    totpToken.trim().length > 0 &&
    confirmPhrase.trim() === RESTORE_CONFIRM_PHRASE &&
    !isPending;

  // マージは試算が済んでいることも条件に加える
  const canMerge =
    mergePlan !== null &&
    snapshotDownloaded &&
    totpToken.trim().length > 0 &&
    confirmPhrase.trim() === MERGE_CONFIRM_PHRASE &&
    !isPending;

  // 暗号鍵が未設定だとバックアップ作成が失敗するため、開いた時点で確認して警告する
  const [encryptionConfigured, setEncryptionConfigured] = useState<boolean | null>(null);
  const [driveConfigured, setDriveConfigured] = useState(false);
  useEffect(() => {
    getEncryptionStatus()
      .then((res) => { setEncryptionConfigured(res.configured); setDriveConfigured(res.driveConfigured); })
      .catch(() => setEncryptionConfigured(null));
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    } catch (e: any) {
      showSnackbar(e.message || "Failed to fetch backups", "error");
    }
  };

  // バックアップ新規作成
  const handleCreateBackup = () => {
    startTransition(async () => {
      try {
        const res = await createBackup();
        if (res.success) {
          // R2 には保存できたが Drive への退避に失敗した場合は、成功で流さず警告する
          if (res.driveError) {
            showSnackbar(tAdmin("backup.driveMirrorFailed", { error: res.driveError }), "error");
          } else {
            showSnackbar(tAdmin("backup.successCreate"), "success");
          }
          await refreshBackupList();
        }
      } catch (e: any) {
        showSnackbar(e.message || "Error creating backup", "error");
      }
    });
  };

  // 既存のバックアップを手動で Google Drive に送る
  const handleSendToDrive = (key: string) => {
    startTransition(async () => {
      try {
        const res = await sendBackupToDrive(key);
        if (res.success) {
          showSnackbar(tAdmin("backup.driveUploadSuccess"), "success");
        } else {
          showSnackbar(tAdmin("backup.driveUploadFailed", { error: res.message }), "error");
        }
      } catch (e: any) {
        showSnackbar(tAdmin("backup.driveUploadFailed", { error: e.message || "unknown" }), "error");
      }
    });
  };

  // バックアップ削除確認
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
      } catch (e: any) {
        showSnackbar(e.message || "Error deleting backup", "error");
      } finally {
        setDeleteTarget(null);
      }
    });
  };

  // R2上のバックアップから復元確認
  // 再認証まわりのエラーコードを利用者向けの文言に変換する
  // サーバーアクションは本番で例外メッセージが秘匿されるため、
  // 失敗はコード付きの戻り値で受け取り、それを文言に変換する
  const actionErrorMessage = (res: { error: string; message: string }) => {
    if (res.error === "TWO_FACTOR_REQUIRED") return tAdmin("backup.twoFactorRequired");
    if (res.error === "INVALID_CODE") return tAdmin("backup.invalidCode");
    return res.message || "Error";
  };

  // 復元ダイアログを開くたびにスナップショットの状態をリセットする
  const resetSnapshotState = () => {
    setSnapshot(null);
    setSnapshotDownloaded(false);
    setTotpToken("");
    setConfirmPhrase("");
  };

  // 現在のDBの内容をスナップショットとして保存し、ブラウザにダウンロードさせる
  const handleDownloadCurrentData = () => {
    startTransition(async () => {
      try {
        const res = await createPreRestoreSnapshot();
        setSnapshot({ key: res.key, downloadUrl: res.downloadUrl });
        window.open(res.downloadUrl, "_blank");
        setSnapshotDownloaded(true);
      } catch (e: any) {
        showSnackbar(e.message || "Error creating snapshot", "error");
      }
    });
  };

  const openRestoreDialog = (key: string) => {
    resetSnapshotState();
    setRestoreTarget(key);
    setRestoreDialogOpen(true);
  };

  // 再認証コードが誤っている場合に入力内容を失わないよう、
  // ダイアログは成功時にのみ閉じます。
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
      } catch (e: any) {
        showSnackbar(e.message || "Error restoring database", "error");
      }
    });
  };

  // ダウンロード処理
  const handleDownload = (key: string) => {
    window.open(`/api/admin/backup/download?key=${encodeURIComponent(key)}`, "_blank");
  };

  // ローカルJSONファイルのアップロードと読み込み
  const handleLocalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        // 簡易バリデーション (JSONパース)
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

    // インプット値をクリアして同じファイルを再度選べるようにする
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // ローカルJSONからの復元実行
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
      } catch (e: any) {
        showSnackbar(e.message || "Error restoring database", "error");
      }
    });
  };

  // マージダイアログを開き、まず試算だけ実行する（DBは変更されない）
  const openMergeDialog = (key: string) => {
    resetSnapshotState();
    setMergePlan(null);
    setMergeTarget(key);
    setMergeDialogOpen(true);

    startTransition(async () => {
      try {
        setMergePlan(await planMergeFromBackup(key));
      } catch (e: any) {
        showSnackbar(e.message || "Error planning merge", "error");
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
      } catch (e: any) {
        showSnackbar(e.message || "Error merging", "error");
      }
    });
  };

  // 復元ダイアログ共通の「現在のデータを退避する」セクション。
  // ダウンロードを終えるまで復元ボタンは押せません。
  const preRestoreSection = (
    <Alert severity="info" sx={{ mt: 2 }}>
      <AlertTitle>{tAdmin("backup.downloadCurrentData")}</AlertTitle>
      <Box sx={{ mb: 1 }}>{tAdmin("backup.downloadCurrentDataDesc")}</Box>
      <Button
        variant="outlined"
        size="small"
        startIcon={<DownloadIcon />}
        onClick={handleDownloadCurrentData}
        disabled={isPending || snapshotDownloaded}
      >
        {tAdmin("backup.downloadCurrentData")}
      </Button>
      {snapshot && snapshotDownloaded && (
        <Box sx={{ mt: 1, fontSize: "0.85em", wordBreak: "break-all" }}>
          {tAdmin("backup.currentDataSaved", { key: snapshot.key })}
        </Box>
      )}
    </Alert>
  );

  // 誤操作防止のための最終確認セクション（確認フレーズ + TOTP）
  const confirmSection = (
    <Stack spacing={2} sx={{ mt: 2 }}>
      <TextField
        label={tAdmin("backup.confirmPhraseLabel", { phrase: activePhrase })}
        size="small"
        value={confirmPhrase}
        onChange={(e) => setConfirmPhrase(e.target.value)}
        disabled={isPending}
        autoComplete="off"
      />
      <TextField
        label={tAdmin("backup.totpLabel")}
        size="small"
        value={totpToken}
        onChange={(e) => setTotpToken(e.target.value)}
        disabled={isPending}
        autoComplete="one-time-code"
        inputMode="numeric"
      />
    </Stack>
  );

  return (
    <Box sx={{ width: "100%", position: "relative" }}>
      {/* 処理中のオーバーレイ表示 */}
      <Backdrop
        sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 999 }}
        open={isPending}
      >
        <Stack spacing={2} sx={{ alignItems: "center" }}>
          <CircularProgress color="inherit" />
          <Typography variant="h6" component="div">
            Processing database operations...
          </Typography>
        </Stack>
      </Backdrop>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{
          justifyContent: "space-between",
          alignItems: { xs: "stretch", sm: "center" },
          mb: 4,
        }}
      >
        <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
          {tAdmin("backup.title")}
        </Typography>

        <Stack direction="row" spacing={2}>
          <input
            type="file"
            accept=".json"
            style={{ display: "none" }}
            ref={fileInputRef}
            onChange={handleLocalFileChange}
          />
          <Button
            variant="outlined"
            startIcon={<CloudUploadIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending}
          >
            {tAdmin("backup.restoreLocalBtn")}
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleCreateBackup}
            disabled={isPending || encryptionConfigured === false}
          >
            {tAdmin("backup.createBtn")}
          </Button>
        </Stack>
      </Stack>

      {encryptionConfigured === false && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <AlertTitle>{tAdmin("backup.encryptionMissingTitle")}</AlertTitle>
          {tAdmin("backup.encryptionMissingDesc")}
        </Alert>
      )}

      <Alert severity="warning" sx={{ mb: 4 }}>
        {tAdmin("backup.restoreWarning")}
      </Alert>

      <TableContainer component={Paper} elevation={2}>
        <Table sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>{tAdmin("backup.tableName")}</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>{tAdmin("backup.created")}</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>{tAdmin("backup.size")}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>{tAdmin("backup.actions")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {backups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 6, color: "text.secondary" }}>
                  {tAdmin("backup.noBackups")}
                </TableCell>
              </TableRow>
            ) : (
              backups.map((backup) => {
                const date = new Date(backup.uploadedAt);
                const displayName = backup.key.replace("backup/", "");
                return (
                  <TableRow key={backup.key} hover>
                    <TableCell sx={{ fontFamily: "monospace" }}>{displayName}</TableCell>
                    <TableCell>{date.toLocaleString(locale === "ja" ? "ja-JP" : "en-US")}</TableCell>
                    <TableCell>{formatBytes(backup.size)}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                        <Tooltip title={tAdmin("backup.download")}>
                          <IconButton
                            color="primary"
                            onClick={() => handleDownload(backup.key)}
                            disabled={isPending}
                          >
                            <DownloadIcon />
                          </IconButton>
                        </Tooltip>
                        {/* 未設定でもボタンは残し、理由をツールチップで伝える */}
                        <Tooltip
                          title={
                            driveConfigured
                              ? tAdmin("backup.sendToDrive")
                              : tAdmin("backup.driveNotConfigured")
                          }
                        >
                          <span>
                            <IconButton
                              color="success"
                              onClick={() => handleSendToDrive(backup.key)}
                              disabled={isPending || !driveConfigured}
                            >
                              <AddToDriveIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={tAdmin("backup.merge")}>
                          <IconButton
                            color="info"
                            onClick={() => openMergeDialog(backup.key)}
                            disabled={isPending}
                          >
                            <MergeIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={tAdmin("backup.restore")}>
                          <IconButton
                            color="warning"
                            onClick={() => openRestoreDialog(backup.key)}
                            disabled={isPending}
                          >
                            <RestoreIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={tAdmin("backup.delete")}>
                          <IconButton
                            color="error"
                            onClick={() => openDeleteDialog(backup.key)}
                            disabled={isPending}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* マージ確認ダイアログ（試算結果を見せてから適用する） */}
      <Dialog open={mergeDialogOpen} onClose={() => setMergeDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle color="info.main">{tAdmin("backup.merge")}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {tAdmin("backup.mergeDesc")}
            <Box sx={{ mt: 1, fontWeight: "bold", fontFamily: "monospace", wordBreak: "break-all" }}>
              {mergeTarget?.replace("backup/", "")}
            </Box>
          </DialogContentText>

          {!mergePlan ? (
            <Box sx={{ py: 3, textAlign: "center", color: "text.secondary" }}>
              {tAdmin("backup.mergePlanning")}
            </Box>
          ) : (
            <>
              <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", mb: 2 }}>
                <Chip color="success" label={tAdmin("backup.mergeInserts", { count: mergePlan.totals.inserts })} />
                <Chip color="warning" label={tAdmin("backup.mergeUpdates", { count: mergePlan.totals.updates })} />
                <Chip variant="outlined" label={tAdmin("backup.mergeSuppressed", { count: mergePlan.totals.suppressedByTombstone })} />
                <Chip variant="outlined" color="info" label={tAdmin("backup.mergeNeedsReview", { count: mergePlan.totals.needsReview })} />
              </Stack>

              {mergePlan.totals.needsReview > 0 && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  {tAdmin("backup.mergeReviewNote")}
                </Alert>
              )}

              {/* 差分のあるテーブルだけを一覧表示する */}
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 320, overflowX: "auto" }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>{tAdmin("backup.mergeTable")}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{tAdmin("backup.mergeStrategy")}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{tAdmin("backup.mergeInsertsShort")}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{tAdmin("backup.mergeUpdatesShort")}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{tAdmin("backup.mergeSuppressedShort")}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{tAdmin("backup.mergeNeedsReviewShort")}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {mergePlan.summaries.filter(
                      (s) => s.inserts + s.updates + s.suppressedByTombstone + s.needsReview > 0
                    ).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 3, color: "text.secondary" }}>
                          {tAdmin("backup.mergeNoChanges")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      mergePlan.summaries
                        .filter((s) => s.inserts + s.updates + s.suppressedByTombstone + s.needsReview > 0)
                        .map((s) => (
                          <TableRow key={s.table} hover>
                            <TableCell sx={{ fontFamily: "monospace" }}>{s.table}</TableCell>
                            <TableCell sx={{ color: "text.secondary" }}>{s.strategy}</TableCell>
                            <TableCell align="right">{s.inserts || "-"}</TableCell>
                            <TableCell align="right">{s.updates || "-"}</TableCell>
                            <TableCell align="right">{s.suppressedByTombstone || "-"}</TableCell>
                            <TableCell align="right">{s.needsReview || "-"}</TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {preRestoreSection}
              {confirmSection}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMergeDialogOpen(false)} color="inherit">
            {tCommon("cancel")}
          </Button>
          <Button onClick={handleConfirmMerge} color="info" variant="contained" disabled={!canMerge}>
            {tAdmin("backup.mergeApply")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{tAdmin("backup.delete")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {tAdmin("backup.confirmDelete")}
            <Box sx={{ mt: 1, fontWeight: "bold", fontFamily: "monospace", wordBreak: "break-all" }}>
              {deleteTarget?.replace("backup/", "")}
            </Box>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} color="inherit">
            {tCommon("cancel")}
          </Button>
          <Button onClick={handleConfirmDelete} color="error" autoFocus>
            {tCommon("delete")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* R2バックアップからの復元確認ダイアログ */}
      <Dialog open={restoreDialogOpen} onClose={() => setRestoreDialogOpen(false)}>
        <DialogTitle color="warning.main">{tAdmin("backup.restore")}</DialogTitle>
        <DialogContent>
          <DialogContentText color="error.main" sx={{ fontWeight: "bold", mb: 2 }}>
            {tAdmin("backup.restoreWarning")}
          </DialogContentText>
          <DialogContentText>
            {tAdmin("backup.confirmRestore")}
            <Box sx={{ mt: 1, fontWeight: "bold", fontFamily: "monospace", wordBreak: "break-all" }}>
              {restoreTarget?.replace("backup/", "")}
            </Box>
          </DialogContentText>
          {preRestoreSection}
          {confirmSection}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialogOpen(false)} color="inherit">
            {tCommon("cancel")}
          </Button>
          <Button
            onClick={handleConfirmRestore}
            color="warning"
            disabled={!canRestore}
          >
            {tAdmin("backup.restore")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ローカルJSONファイルからの復元確認ダイアログ */}
      <Dialog open={localRestoreDialogOpen} onClose={() => setLocalRestoreDialogOpen(false)}>
        <DialogTitle color="warning.main">{tAdmin("backup.restore")}</DialogTitle>
        <DialogContent>
          <DialogContentText color="error.main" sx={{ fontWeight: "bold", mb: 2 }}>
            {tAdmin("backup.restoreWarning")}
          </DialogContentText>
          <DialogContentText>
            {tAdmin("backup.confirmRestore")}
          </DialogContentText>
          {preRestoreSection}
          {confirmSection}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLocalRestoreDialogOpen(false)} color="inherit">
            {tCommon("cancel")}
          </Button>
          <Button
            onClick={handleConfirmLocalRestore}
            color="warning"
            disabled={!canRestore}
          >
            {tAdmin("backup.restore")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 結果通知スナックバー */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
