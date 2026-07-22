import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Stack from "@mui/material/Stack";
import DownloadIcon from "@mui/icons-material/Download";
import AddToDriveIcon from "@mui/icons-material/AddToDrive";
import MergeIcon from "@mui/icons-material/CallMerge";
import RestoreIcon from "@mui/icons-material/SettingsBackupRestore";
import DeleteIcon from "@mui/icons-material/Delete";
import { useTranslations } from "next-intl";

type Backup = {
  key: string;
  size: number;
  uploadedAt: string;
};

export type BackupTableProps = {
  backups: Backup[];
  isPending: boolean;
  driveConfigured: boolean;
  locale: string;
  onDownload: (key: string) => void;
  onSendToDrive: (key: string) => void;
  onMerge: (key: string) => void;
  onRestore: (key: string) => void;
  onDelete: (key: string) => void;
};

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

/**
 * 管理画面でバックアップ履歴の一覧をテーブル形式で表示し、
 * ダウンロード、Google Drive転送、マージ、復元、削除の各アクションを提供するコンポーネント。
 */
const BackupTable = ({
  backups,
  isPending,
  driveConfigured,
  locale,
  onDownload,
  onSendToDrive,
  onMerge,
  onRestore,
  onDelete
}: BackupTableProps) => {
  const tAdmin = useTranslations("Admin");

  return (
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
                          onClick={() => onDownload(backup.key)}
                          disabled={isPending}
                        >
                          <DownloadIcon />
                        </IconButton>
                      </Tooltip>
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
                            onClick={() => onSendToDrive(backup.key)}
                            disabled={isPending || !driveConfigured}
                          >
                            <AddToDriveIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title={tAdmin("backup.merge")}>
                        <IconButton
                          color="info"
                          onClick={() => onMerge(backup.key)}
                          disabled={isPending}
                        >
                          <MergeIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={tAdmin("backup.restore")}>
                        <IconButton
                          color="warning"
                          onClick={() => onRestore(backup.key)}
                          disabled={isPending}
                        >
                          <RestoreIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={tAdmin("backup.delete")}>
                        <IconButton
                          color="error"
                          onClick={() => onDelete(backup.key)}
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
  );
};

export default BackupTable;
