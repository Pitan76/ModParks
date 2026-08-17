"use client";

import { useState } from "react";
import type { MouseEvent } from "react";
import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import TypedConfirmDialog from "@/components/ui/TypedConfirmDialog";
import BatchProjectMcVersionDialog from "./BatchProjectMcVersionDialog";
import BatchProjectSettingsDialog from "./BatchProjectSettingsDialog";
import BatchProjectOperationsTable from "./BatchProjectOperationsTable";
import { useBatchProjectOperations } from "./useBatchProjectOperations";

type ProjectForManagement = {
  id: string;
  slug: string;
  title: string;
  type: string;
  visibility: string;
  downloads: number | null;
  totalDownloads: number | null;
  githubRepo?: string | null;
  latestVersionNumber?: string | null;
};

export type BatchProjectOperationsClientProps = {
  projects: ProjectForManagement[];
};

/**
 * 管理画面で複数プロジェクトの一括公開ステータス変更、または一括削除操作を提供するクライアントコンポーネント。
 */
const BatchProjectOperationsClient = ({ projects }: BatchProjectOperationsClientProps) => {
  const t = useTranslations("Project.batch");
  const m = useBatchProjectOperations(projects);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleStatusClick = (event: MouseEvent<HTMLButtonElement>) => setAnchorEl(event.currentTarget);
  const handleStatusClose = () => setAnchorEl(null);

  const handleStatusSelect = (status: "public" | "unlisted" | "private" | "draft") => {
    handleStatusClose();
    m.handleBatchStatus(status);
  };

  return (
    <Box>
      {m.error && <Alert severity="error" sx={{ mb: 3 }}>{m.error}</Alert>}

      <Box sx={{ mb: 2, display: "flex", gap: { xs: 1, sm: 2 }, alignItems: "center", flexWrap: "wrap" }}>
        <Button
          variant="contained"
          startIcon={<EditIcon />}
          onClick={handleStatusClick}
          disabled={m.selected.size === 0 || m.loading}
        >
          {t("changeStatus")}
        </Button>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<EditIcon />}
          onClick={() => m.setMcVersionDialogOpen(true)}
          disabled={m.selected.size === 0 || m.loading}
        >
          {t("editMcVersions")}
        </Button>
        <Button
          variant="contained"
          color="info"
          startIcon={<EditIcon />}
          onClick={() => m.setSettingsDialogOpen(true)}
          disabled={m.selected.size === 0 || m.loading}
        >
          {t("editSettings")}
        </Button>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleStatusClose}>
          <MenuItem onClick={() => handleStatusSelect("public")}>{t("makePublic")}</MenuItem>
          <MenuItem onClick={() => handleStatusSelect("unlisted")}>{t("makeUnlisted")}</MenuItem>
          <MenuItem onClick={() => handleStatusSelect("private")}>{t("makePrivate")}</MenuItem>
          <MenuItem onClick={() => handleStatusSelect("draft")}>{t("makeDraft")}</MenuItem>
        </Menu>

        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={() => m.setDeleteDialogOpen(true)}
          disabled={m.selected.size === 0 || m.loading}
        >
          {t("delete")}
        </Button>

        <Box sx={{ flexGrow: 1 }} />
        {m.selected.size > 0 && (
          <Box sx={{ typography: "body2", color: "text.secondary" }}>
            {t("selectedCount", { count: m.selected.size })}
          </Box>
        )}
      </Box>

      <BatchProjectOperationsTable
        projects={projects}
        selected={m.selected}
        onToggle={m.handleToggle}
        onToggleAll={m.handleToggleAll}
        getStatusLabel={m.getStatusLabel}
      />

      <TypedConfirmDialog
        open={m.deleteDialogOpen}
        onClose={() => !m.loading && m.setDeleteDialogOpen(false)}
        onConfirm={m.handleBatchDelete}
        title={t("deleteTitle")}
        description={t.rich("deleteDescription", { count: m.selected.size, b: (chunks) => <strong>{chunks}</strong> })}
        expectedValue="DELETE"
        expectedValueLabel={t("deleteConfirmLabel")}
        pending={m.loading}
      />

      <BatchProjectMcVersionDialog
        open={m.mcVersionDialogOpen}
        onClose={() => m.setMcVersionDialogOpen(false)}
        selectedCount={m.selected.size}
        pending={m.loading}
        onSubmit={m.handleBatchMcVersions}
      />

      <BatchProjectSettingsDialog
        open={m.settingsDialogOpen}
        onClose={() => m.setSettingsDialogOpen(false)}
        selectedCount={m.selected.size}
        pending={m.loading}
        onSubmit={m.handleBatchSettings}
      />
    </Box>
  );
};

export default BatchProjectOperationsClient;
