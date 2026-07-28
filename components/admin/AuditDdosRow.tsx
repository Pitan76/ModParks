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

type DdosLog = {
  id: string;
  createdAt: string | Date;
  performedBy: string | null;
  performedByEmail: string | null;
  action: string;
  state: string;
  detail: unknown;
};

export type AuditDdosRowProps = {
  log: DdosLog;
  t: (key: string) => string;
};

function getActionColor(action: string): "error" | "warning" | "success" | "info" | "default" {
  switch (action) {
    case "auto_activate": case "manual_activate": return "error";
    case "auto_activate_failed": case "auto_deactivate_failed": return "warning";
    case "auto_deactivate": case "manual_deactivate": return "success";
    case "recover": return "info";
    default: return "default";
  }
}

/**
 * 監査ログ画面において、DDoS防護の状態遷移ログの1レコードを表示するテーブル行コンポーネント。
 * アコーディオン開閉により、検知メトリクスや対象slug、エラー内容などの詳細を展開表示します。
 */
const AuditDdosRow = ({ log, t }: AuditDdosRowProps) => {
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
        <TableCell>{log.performedByEmail || log.performedBy || "System (Auto)"}</TableCell>
        <TableCell>
          <Chip label={log.action} size="small" color={getActionColor(log.action)} />
        </TableCell>
        <TableCell>
          <Chip label={log.state} size="small" variant="outlined" />
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={5}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1, p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom component="div" sx={{ fontWeight: 700 }}>
                {t("detail")}
              </Typography>
              {log.detail ? (
                <Paper variant="outlined" sx={{ p: 1.5, mt: 0.5, bgcolor: "background.paper", fontFamily: "monospace", fontSize: "0.85rem", whiteSpace: "pre-wrap", overflowX: "auto" }}>
                  {JSON.stringify(log.detail, null, 2)}
                </Paper>
              ) : null}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

export default AuditDdosRow;
