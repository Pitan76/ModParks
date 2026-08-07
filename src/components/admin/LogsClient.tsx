"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import { getSettingsAudits, getBackupAudits, getDdosAudits } from "@/lib/actions/admin";
import AuditSettingsRow from "./AuditSettingsRow";
import AuditBackupRow from "./AuditBackupRow";
import AuditDdosRow from "./AuditDdosRow";
import AuditLogTable from "./AuditLogTable";
import { useAuditLogPage } from "./useAuditLogPage";

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

type DdosLog = {
  id: string;
  createdAt: string | Date;
  performedBy: string | null;
  performedByEmail: string | null;
  action: string;
  state: string;
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
  initialDdos: {
    logs: DdosLog[];
    total: number;
  };
};

/**
 * 管理者向けのシステム変更監査ログおよびバックアップ実行監査ログの閲覧画面コンポーネント。
 * タブ切り替えによって両ログの一覧表示とページネーションによる動的読み込みを提供します。
 */
const LogsClient = ({ initialSettings, initialBackups, initialDdos }: LogsClientProps) => {
  const t = useTranslations("Admin.audit");
  const [tabIndex, setTabIndex] = useState(0);

  const settings = useAuditLogPage<SettingsLog>(initialSettings, getSettingsAudits);
  const backups = useAuditLogPage<BackupLog>(initialBackups, getBackupAudits);
  const ddos = useAuditLogPage<DdosLog>(initialDdos, getDdosAudits);

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 4 }}>
        {t("title")}
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tabs value={tabIndex} onChange={(_, value) => setTabIndex(value)} aria-label="audit log tabs">
          <Tab label={t("settingsTab")} />
          <Tab label={t("backupTab")} />
          <Tab label={t("ddosTab")} />
        </Tabs>
      </Box>

      {tabIndex === 0 && (
        <AuditLogTable
          state={settings}
          headers={[t("date"), t("operator"), t("scope"), t("key")]}
          emptyLabel={t("noLogs")}
          renderRow={(log) => <AuditSettingsRow key={log.id} log={log} t={t} />}
        />
      )}

      {tabIndex === 1 && (
        <AuditLogTable
          state={backups}
          headers={[t("date"), t("operator"), t("action"), t("status")]}
          emptyLabel={t("noLogs")}
          renderRow={(log) => <AuditBackupRow key={log.id} log={log} t={t} />}
        />
      )}

      {tabIndex === 2 && (
        <AuditLogTable
          state={ddos}
          headers={[t("date"), t("operator"), t("action"), t("state")]}
          emptyLabel={t("noLogs")}
          renderRow={(log) => <AuditDdosRow key={log.id} log={log} t={t} />}
        />
      )}
    </Box>
  );
};

export default LogsClient;
