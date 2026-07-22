import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import BackupConfirmSection from "./BackupConfirmSection";
import { useTranslations } from "next-intl";

export type RestoreBackupDialogProps = {
  open: boolean;
  onClose: () => void;
  targetName: string | null;
  snapshotDownloaded: boolean;
  snapshot: { key: string; downloadUrl: string } | null;
  confirmPhrase: string;
  totpToken: string;
  isPending: boolean;
  onDownloadSnapshot: () => void;
  onChangeConfirmPhrase: (val: string) => void;
  onChangeTotpToken: (val: string) => void;
  onConfirm: () => void;
};

const RESTORE_CONFIRM_PHRASE = "RESTORE";

/**
 * データベースの全復元を実行するための確認ダイアログ。
 * 現在のDBデータをエクスポート（ダウンロード）することを強制し、
 * 正しい確認フレーズとTOTP再認証トークンを入力した後にのみ、復元処理を実行可能にします。
 */
const RestoreBackupDialog = ({
  open,
  onClose,
  targetName,
  snapshotDownloaded,
  snapshot,
  confirmPhrase,
  totpToken,
  isPending,
  onDownloadSnapshot,
  onChangeConfirmPhrase,
  onChangeTotpToken,
  onConfirm
}: RestoreBackupDialogProps) => {
  const tAdmin = useTranslations("Admin");
  const tCommon = useTranslations("Common");

  const canRestore =
    snapshotDownloaded &&
    totpToken.trim().length > 0 &&
    confirmPhrase.trim() === RESTORE_CONFIRM_PHRASE &&
    !isPending;

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle color="warning.main">{tAdmin("backup.restore")}</DialogTitle>
      <DialogContent>
        <DialogContentText color="error.main" sx={{ fontWeight: "bold", mb: 2 }}>
          {tAdmin("backup.restoreWarning")}
        </DialogContentText>
        <DialogContentText>
          {tAdmin("backup.confirmRestore")}
          {targetName && (
            <Box sx={{ mt: 1, fontWeight: "bold", fontFamily: "monospace", wordBreak: "break-all" }}>
              {targetName.replace("backup/", "")}
            </Box>
          )}
        </DialogContentText>
        <BackupConfirmSection
          snapshotDownloaded={snapshotDownloaded}
          snapshot={snapshot}
          confirmPhrase={confirmPhrase}
          totpToken={totpToken}
          isPending={isPending}
          activePhrase={RESTORE_CONFIRM_PHRASE}
          onDownloadSnapshot={onDownloadSnapshot}
          onChangeConfirmPhrase={onChangeConfirmPhrase}
          onChangeTotpToken={onChangeTotpToken}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          {tCommon("cancel")}
        </Button>
        <Button
          onClick={onConfirm}
          color="warning"
          disabled={!canRestore}
        >
          {tAdmin("backup.restore")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RestoreBackupDialog;
