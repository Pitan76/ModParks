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
import CircularProgress from "@mui/material/CircularProgress";
import { getSettingsAudits, getBackupAudits } from "@/lib/actions/admin";
import AuditSettingsRow from "./AuditSettingsRow";
import AuditBackupRow from "./AuditBackupRow";

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

export type LogsClientProps = {
  initialSettings: {
    logs: SettingsLog[];
    total: number;
  };
  initialBackups: {
    logs: BackupLog[];
    total: number;
  };
};

/**
 * 管理者向けのシステム変更監査ログおよびバックアップ実行監査ログの閲覧画面コンポーネント。
 * タブ切り替えによって両ログの一覧表示とページネーションによる動的読み込みを提供します。
 */
const LogsClient = ({ initialSettings, initialBackups }: LogsClientProps) => {
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

  const handleSettingsPageChange = async (_event: unknown, newPage: number) => {
    setSettingsPage(newPage);
    setLoadingSettings(true);
    try {
      const res = await getSettingsAudits(10, (newPage - 1) * 10);
      setSettingsLogs(res.logs);
      setSettingsTotal(res.total);
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleBackupsPageChange = async (_event: unknown, newPage: number) => {
    setBackupsPage(newPage);
    setLoadingBackups(true);
    try {
      const res = await getBackupAudits(10, (newPage - 1) * 10);
      setBackupsLogs(res.logs);
      setBackupsTotal(res.total);
    } catch (e: unknown) {
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
              </TableHead>
              <TableBody>
                {settingsLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 3, color: "text.secondary" }}>
                      {t("noLogs")}
                    </TableCell>
                  </TableRow>
                ) : (
                  settingsLogs.map((log) => (
                    <AuditSettingsRow key={log.id} log={log} t={t} />
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
              </TableHead>
              <TableBody>
                {backupsLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 3, color: "text.secondary" }}>
                      {t("noLogs")}
                    </TableCell>
                  </TableRow>
                ) : (
                  backupsLogs.map((log) => (
                    <AuditBackupRow key={log.id} log={log} t={t} />
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
};

export default LogsClient;
