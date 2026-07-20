"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Pagination from "@mui/material/Pagination";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { getSettingsAudits, getBackupAudits } from "@/lib/actions/admin";

interface LogsClientProps {
  initialSettings: {
    logs: any[];
    total: number;
  };
  initialBackups: {
    logs: any[];
    total: number;
  };
}

function SettingsRow({ log, t }: { log: any; t: any }) {
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
}

function BackupRow({ log, t }: { log: any; t: any }) {
  const [open, setOpen] = useState(false);

  const getActionColor = (action: string) => {
    switch (action) {
      case "restore": return "error";
      case "merge": return "warning";
      case "create": case "auto_create": return "success";
      default: return "default";
    }
  };

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
          <Chip label={log.action} size="small" color={getActionColor(log.action) as any} />
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
                {log.detail && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Execution Summary / Error Payload</Typography>
                    <Paper variant="outlined" sx={{ p: 1.5, mt: 0.5, bgcolor: "background.paper", fontFamily: "monospace", fontSize: "0.85rem", whiteSpace: "pre-wrap", overflowX: "auto" }}>
                      {JSON.stringify(log.detail, null, 2)}
                    </Paper>
                  </Box>
                )}
              </Box>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function LogsClient({ initialSettings, initialBackups }: LogsClientProps) {
  const t = useTranslations("Admin.audit");
  const [tabIndex, setTabIndex] = useState(0);

  const [settingsPage, setSettingsPage] = useState(1);
  const [settingsLogs, setSettingsLogs] = useState(initialSettings.logs);
  const [settingsTotal, setSettingsTotal] = useState(initialSettings.total);
  const [loadingSettings, setLoadingSettings] = useState(false);

  const [backupsPage, setBackupsPage] = useState(1);
  const [backupsLogs, setBackupsLogs] = useState(initialBackups.logs);
  const [backupsTotal, setBackupsTotal] = useState(initialBackups.total);
  const [loadingBackups, setLoadingBackups] = useState(false);

  const handleSettingsPageChange = async (_event: any, newPage: number) => {
    setSettingsPage(newPage);
    setLoadingSettings(true);
    try {
      const res = await getSettingsAudits(10, (newPage - 1) * 10);
      setSettingsLogs(res.logs);
      setSettingsTotal(res.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleBackupsPageChange = async (_event: any, newPage: number) => {
    setBackupsPage(newPage);
    setLoadingBackups(true);
    try {
      const res = await getBackupAudits(10, (newPage - 1) * 10);
      setBackupsLogs(res.logs);
      setBackupsTotal(res.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingBackups(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 4 }}>
        {t("title")}
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tabs value={tabIndex} onChange={(_, value) => setTabIndex(value)} aria-label="audit log tabs">
          <Tab label={t("settingsTab")} />
          <Tab label={t("backupTab")} />
        </Tabs>
      </Box>

      {/* Settings Logs Tab */}
      {tabIndex === 0 && (
        <Box sx={{ position: "relative" }}>
          {loadingSettings && (
            <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", justifyContent: "center", alignItems: "center", bgcolor: "rgba(255,255,255,0.4)", zIndex: 1 }}>
              <CircularProgress />
            </Box>
          )}

          <TableContainer component={Paper} variant="outlined" sx={{ opacity: loadingSettings ? 0.6 : 1 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell>{t("date")}</TableCell>
                  <TableCell>{t("operator")}</TableCell>
                  <TableCell>{t("scope")}</TableCell>
                  <TableCell>{t("key")}</TableCell>
                </TableRow>
              </Head>
              <TableBody>
                {settingsLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 3, color: "text.secondary" }}>
                      {t("noLogs")}
                    </TableCell>
                  </TableRow>
                ) : (
                  settingsLogs.map((log) => (
                    <SettingsRow key={log.id} log={log} t={t} />
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {settingsTotal > 10 && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
              <Pagination
                count={Math.ceil(settingsTotal / 10)}
                page={settingsPage}
                onChange={handleSettingsPageChange}
                color="primary"
              />
            </Box>
          )}
        </Box>
      )}

      {/* Backup Logs Tab */}
      {tabIndex === 1 && (
        <Box sx={{ position: "relative" }}>
          {loadingBackups && (
            <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", justifyContent: "center", alignItems: "center", bgcolor: "rgba(255,255,255,0.4)", zIndex: 1 }}>
              <CircularProgress />
            </Box>
          )}

          <TableContainer component={Paper} variant="outlined" sx={{ opacity: loadingBackups ? 0.6 : 1 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell>{t("date")}</TableCell>
                  <TableCell>{t("operator")}</TableCell>
                  <TableCell>{t("action")}</TableCell>
                  <TableCell>{t("status")}</TableCell>
                </TableRow>
              </Head>
              <TableBody>
                {backupsLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 3, color: "text.secondary" }}>
                      {t("noLogs")}
                    </TableCell>
                  </TableRow>
                ) : (
                  backupsLogs.map((log) => (
                    <BackupRow key={log.id} log={log} t={t} />
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {backupsTotal > 10 && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
              <Pagination
                count={Math.ceil(backupsTotal / 10)}
                page={backupsPage}
                onChange={handleBackupsPageChange}
                color="primary"
              />
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
