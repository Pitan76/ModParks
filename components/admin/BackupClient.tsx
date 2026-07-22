"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Snackbar from "@mui/material/Snackbar";
import Backdrop from "@mui/material/Backdrop";
import AddIcon from "@mui/icons-material/Add";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import BackupTable from "./BackupTable";
import MergeBackupDialog from "./MergeBackupDialog";
import RestoreBackupDialog from "./RestoreBackupDialog";
import { useBackupActions } from "./useBackupActions";

type Backup = {
  key: string;
  size: number;
  uploadedAt: string;
};

export type BackupClientProps = {
  initialBackups: Backup[];
  locale: string;
};

/**
 * 管理者向けのデータベース・バックアップおよびリストア管理画面コンポーネント。
 * 新規バックアップの作成、削除、R2からのダウンロード、Google Driveへの転送、
 * バックアップデータからのマージ（差分追加）、および全体の切り戻し（復元）操作を提供します。
 */
const BackupClient = ({ initialBackups, locale }: BackupClientProps) => {
  const tAdmin = useTranslations("Admin");
  const tCommon = useTranslations("Common");

  const {
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
  } = useBackupActions(initialBackups);

  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <Box sx={{ width: "100%", position: "relative" }}>
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

      <BackupTable
        backups={backups}
        isPending={isPending}
        driveConfigured={driveConfigured}
        locale={locale}
        onDownload={handleDownload}
        onSendToDrive={handleSendToDrive}
        onMerge={openMergeDialog}
        onRestore={openRestoreDialog}
        onDelete={openDeleteDialog}
      />

      <MergeBackupDialog
        open={mergeDialogOpen}
        onClose={() => setMergeDialogOpen(false)}
        mergeTarget={mergeTarget}
        mergePlan={mergePlan}
        snapshotDownloaded={snapshotDownloaded}
        snapshot={snapshot}
        confirmPhrase={confirmPhrase}
        totpToken={totpToken}
        isPending={isPending}
        onDownloadSnapshot={handleDownloadCurrentData}
        onChangeConfirmPhrase={setConfirmPhrase}
        onChangeTotpToken={setTotpToken}
        onConfirm={handleConfirmMerge}
      />

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

      <RestoreBackupDialog
        open={restoreDialogOpen}
        onClose={() => setRestoreDialogOpen(false)}
        targetName={restoreTarget}
        snapshotDownloaded={snapshotDownloaded}
        snapshot={snapshot}
        confirmPhrase={confirmPhrase}
        totpToken={totpToken}
        isPending={isPending}
        onDownloadSnapshot={handleDownloadCurrentData}
        onChangeConfirmPhrase={setConfirmPhrase}
        onChangeTotpToken={setTotpToken}
        onConfirm={handleConfirmRestore}
      />

      <RestoreBackupDialog
        open={localRestoreDialogOpen}
        onClose={() => setLocalRestoreDialogOpen(false)}
        targetName="Local File"
        snapshotDownloaded={snapshotDownloaded}
        snapshot={snapshot}
        confirmPhrase={confirmPhrase}
        totpToken={totpToken}
        isPending={isPending}
        onDownloadSnapshot={handleDownloadCurrentData}
        onChangeConfirmPhrase={setConfirmPhrase}
        onChangeTotpToken={setTotpToken}
        onConfirm={handleConfirmLocalRestore}
      />

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
};

export default BackupClient;
