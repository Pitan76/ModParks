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

type SettingsLog = {
  id: string;
  createdAt: string | Date;
  changedBy: string;
  changedByEmail: string | null;
  scope: string;
  key: string;
  oldValue: unknown;
  newValue: unknown;
  prUrl?: string | null;
};

export type AuditSettingsRowProps = {
  log: SettingsLog;
  t: (key: string) => string;
};

/**
 * 監査ログ画面において、設定変更ログの1レコードを表示するテーブル行コンポーネント。
 * アコーディオン開閉により、変更前と変更後の詳細を差分比較形式で展開表示します。
 */
const AuditSettingsRow = ({ log, t }: AuditSettingsRowProps) => {
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
        <TableCell>{log.changedByEmail || log.changedBy}</TableCell>
        <TableCell>
          <Chip label={log.scope} size="small" variant="outlined" />
        </TableCell>
        <TableCell sx={{ fontWeight: 600 }}>{log.key}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={5}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1, p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom component="div" sx={{ fontWeight: 700 }}>
                {t("detail")}
              </Typography>
              <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", md: "row" }, mt: 1 }}>
                {log.scope !== "secret" ? (
                  <>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" color="text.secondary">{t("oldValue")}</Typography>
                      <Paper variant="outlined" sx={{ p: 1.5, mt: 0.5, bgcolor: "background.paper", fontFamily: "monospace", fontSize: "0.85rem", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                        {log.oldValue !== null ? String(log.oldValue) : "NULL"}
                      </Paper>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" color="text.secondary">{t("newValue")}</Typography>
                      <Paper variant="outlined" sx={{ p: 1.5, mt: 0.5, bgcolor: "background.paper", fontFamily: "monospace", fontSize: "0.85rem", whiteSpace: "pre-wrap", wordBreak: "break-all", borderLeft: "3px solid", borderColor: "success.main" }}>
                        {log.newValue !== null ? String(log.newValue) : "NULL"}
                      </Paper>
                    </Box>
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    シークレットの値はセキュリティ上、記録されません。
                  </Typography>
                )}
              </Box>
              {log.prUrl && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary">PR URL</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    <a href={log.prUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#3f51b5", textDecoration: "underline" }}>
                      {log.prUrl}
                    </a>
                  </Typography>
                </Box>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

export default AuditSettingsRow;
