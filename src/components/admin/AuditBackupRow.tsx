import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

type BackupLog = {
  id: string;
  createdAt: string | Date;
  performedBy: string | null;
  performedByEmail: string | null;
  action: string;
  status: string;
  backupKey: string | null;
  snapshotKey: string | null;
  detail: unknown;
};

export type AuditBackupRowProps = {
  log: BackupLog;
  t: (key: string) => string;
};

const getActionColor = (action: string): "error" | "warning" | "success" | "default" => {
  switch (action) {
    case "restore": return "error";
    case "merge": return "warning";
    case "create": case "auto_create": return "success";
    default: return "default";
  }
};

/**
 * 監査ログ画面において、バックアップ実行ログの1レコードを表示するテーブル行コンポーネント。
 * アコーディオン開閉により、バックアップファイルキー、ロールバックスナップショットキー、
 * および実行のサマリーやエラー詳細を展開表示します。
 */
const AuditBackupRow = ({ log, t }: AuditBackupRowProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableRow sx={{ "& > *": { borderBottom: "unset" } }}>
        <TableCell sx={{ width: 50 }}>
          <IconButton size="small" onClick={() => setOpen(!open)}>
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell suppressHydrationWarning sx={{ minWidth: 150 }}>
          {new Date(log.createdAt).toLocaleString()}
        </TableCell>
        <TableCell>{log.performedByEmail || log.performedBy || "System (Cron)"}</TableCell>
        <TableCell>
          <Chip label={log.action} size="small" color={getActionColor(log.action)} />
        </TableCell>
        <TableCell>
          <Chip
            label={log.status === "success" ? "SUCCESS" : "FAILURE"}
            size="small"
            color={log.status === "success" ? "success" : "error"}
            variant="outlined"
          />
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={5}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1, p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom component="div" sx={{ fontWeight: 700 }}>
                {t("detail")}
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 1 }}>
                {log.backupKey && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Backup File Key (R2)</Typography>
                    <Typography variant="body2" sx={{ fontFamily: "monospace", mt: 0.5 }}>{log.backupKey}</Typography>
                  </Box>
                )}
                {log.snapshotKey && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Rollback Snapshot Key (R2)</Typography>
                    <Typography variant="body2" sx={{ fontFamily: "monospace", mt: 0.5 }}>{log.snapshotKey}</Typography>
                  </Box>
                )}
                {log.detail ? (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Execution Summary / Error Payload</Typography>
                    <Paper variant="outlined" sx={{ p: 1.5, mt: 0.5, bgcolor: "background.paper", fontFamily: "monospace", fontSize: "0.85rem", whiteSpace: "pre-wrap", overflowX: "auto" }}>
                      {JSON.stringify(log.detail, null, 2)}
                    </Paper>
                  </Box>
                ) : null}
              </Box>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

export default AuditBackupRow;
