import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";
import BackupConfirmSection from "./BackupConfirmSection";
import type { MergePlan } from "@/lib/backup/merge";
import { useTranslations } from "next-intl";

export type MergeBackupDialogProps = {
  open: boolean;
  onClose: () => void;
  mergeTarget: string | null;
  mergePlan: MergePlan | null;
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

const MERGE_CONFIRM_PHRASE = "MERGE";

/**
 * 既存のDBに別のバックアップデータを統合するための確認ダイアログ。
 * 試算されたマージ計画（追加・更新・スキップ等の件数）をテーブル表示し、
 * TOTP等による認証をパスした後にのみマージを適用可能にします。
 */
const MergeBackupDialog = ({
  open,
  onClose,
  mergeTarget,
  mergePlan,
  snapshotDownloaded,
  snapshot,
  confirmPhrase,
  totpToken,
  isPending,
  onDownloadSnapshot,
  onChangeConfirmPhrase,
  onChangeTotpToken,
  onConfirm
}: MergeBackupDialogProps) => {
  const tAdmin = useTranslations("Admin");
  const tCommon = useTranslations("Common");

  const canMerge =
    mergePlan !== null &&
    snapshotDownloaded &&
    totpToken.trim().length > 0 &&
    confirmPhrase.trim() === MERGE_CONFIRM_PHRASE &&
    !isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
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

            <BackupConfirmSection
              snapshotDownloaded={snapshotDownloaded}
              snapshot={snapshot}
              confirmPhrase={confirmPhrase}
              totpToken={totpToken}
              isPending={isPending}
              activePhrase={MERGE_CONFIRM_PHRASE}
              onDownloadSnapshot={onDownloadSnapshot}
              onChangeConfirmPhrase={onChangeConfirmPhrase}
              onChangeTotpToken={onChangeTotpToken}
            />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          {tCommon("cancel")}
        </Button>
        <Button onClick={onConfirm} color="info" variant="contained" disabled={!canMerge}>
          {tAdmin("backup.mergeApply")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MergeBackupDialog;
