"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import AddIcon from "@mui/icons-material/Add";
import GitHubIcon from "@mui/icons-material/GitHub";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import LinkIcon from "@mui/icons-material/Link";
import LayersIcon from "@mui/icons-material/Layers";
import { useState } from "react";
import type { GithubImportMode } from "@/lib/utils/github";
import AbstractDialog from "@/components/ui/AbstractDialog";
import { useTranslations } from "next-intl";
import TypedConfirmDialog from "@/components/ui/TypedConfirmDialog";
import VersionUploadForm from "@/components/project/VersionUploadForm";
import EditVersionDialog from "./EditVersionDialog";
import VersionsManagerTable from "./VersionsManagerTable";
import BatchAddMcVersionDialog from "./BatchAddMcVersionDialog";
import { useVersionsManager, type ProjectVersion } from "./useVersionsManager";
import type { VersionUploadContext } from "@/lib/queries/versionUploadContext";

export type { ProjectVersion } from "./useVersionsManager";

export type ProjectVersionsManagerProps = {
  versions: ProjectVersion[];
  githubRepo?: string | null;
  /**
   * バージョン追加フォームの前提データ。スラッグ・アイデア一覧・プラットフォーム・
   * 外部連携の可否はここから取り出し、バージョン追加ページと同じ内容を使う。
   */
  uploadContext: VersionUploadContext;
};

/**
 * プロジェクト詳細の管理画面で、リリースされたバージョンの一覧と管理機能
 * （アーカイブ、削除、編集、レシピ抽出、Githubインポート）を提供する。
 */
const ProjectVersionsManager = ({
  versions: initialVersions,
  githubRepo,
  uploadContext,
}: ProjectVersionsManagerProps) => {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Version");
  const { slug: projectSlug, openIdeas, availablePlatforms, modrinthSyncAvailable, curseforgeSyncAvailable } = uploadContext;
  const m = useVersionsManager(projectSlug, initialVersions);
  const [importAnchor, setImportAnchor] = useState<HTMLElement | null>(null);

  const handleImportSelect = (mode: GithubImportMode) => {
    setImportAnchor(null);
    m.handleImportGithub(mode);
  };

  return (
    <Box sx={{ width: "100%", overflow: "hidden" }}>
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          justifyContent: "flex-end",
          alignItems: { xs: "stretch", md: "center" },
          gap: 2,
          mb: 3,
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ width: { xs: "100%", md: "auto" }, alignItems: { xs: "stretch", sm: "center" }, flexShrink: 0 }}
        >
          {githubRepo && (
            <>
              <Button
                variant="outlined"
                startIcon={<GitHubIcon />}
                endIcon={<ArrowDropDownIcon />}
                onClick={(e) => setImportAnchor(e.currentTarget)}
                disabled={m.importing}
                sx={{ whiteSpace: "nowrap" }}
              >
                {m.importing ? t("manager.importing") : t("manager.importGithub")}
              </Button>
              <Menu anchorEl={importAnchor} open={!!importAnchor} onClose={() => setImportAnchor(null)}>
                <MenuItem onClick={() => handleImportSelect("file")}>
                  <ListItemIcon><CloudUploadIcon fontSize="small" /></ListItemIcon>
                  <ListItemText primary={t("manager.importModeFile")} secondary={t("manager.importModeFileHint")} />
                </MenuItem>
                <MenuItem onClick={() => handleImportSelect("link")}>
                  <ListItemIcon><LinkIcon fontSize="small" /></ListItemIcon>
                  <ListItemText primary={t("manager.importModeLink")} secondary={t("manager.importModeLinkHint")} />
                </MenuItem>
              </Menu>
            </>
          )}
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => m.setUploadOpen(true)} sx={{ whiteSpace: "nowrap" }}>
            {t("manager.addVersion")}
          </Button>
        </Stack>
      </Box>

      {m.selected.size > 0 && (
        <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <Button variant="outlined" startIcon={<LayersIcon />} onClick={() => m.setBatchOpen(true)}>
            {t("manager.batch.addMcVersion")}
          </Button>
          <Box sx={{ typography: "body2", color: "text.secondary" }}>
            {t("manager.batch.selectedCount", { count: m.selected.size })}
          </Box>
        </Box>
      )}

      {m.importMsg && (
        <Alert severity={m.importMsg.severity} sx={{ mb: 3 }} onClose={() => m.setImportMsg(null)}>
          {m.importMsg.text}
        </Alert>
      )}
      {m.errorMsg && <Alert severity="error" sx={{ mb: 3 }}>{m.errorMsg}</Alert>}

      <VersionsManagerTable
        parsedVersions={m.parsedVersions}
        isEmpty={m.localVersions.length === 0}
        extractingId={m.extractingId}
        archivingId={m.archivingId}
        selected={m.selected}
        onToggleSelect={m.handleToggleSelect}
        onToggleSelectAll={m.handleToggleSelectAll}
        onExtract={m.handleExtractRecipes}
        onToggleArchive={m.handleToggleArchive}
        onEdit={m.setEditTarget}
        onDelete={m.setDeleteId}
      />

      <BatchAddMcVersionDialog
        open={m.batchOpen}
        onClose={() => m.setBatchOpen(false)}
        selectedCount={m.selected.size}
        modrinthAvailable={modrinthSyncAvailable}
        curseforgeAvailable={curseforgeSyncAvailable}
        pending={m.batchPending}
        onSubmit={m.handleBatchAddMcVersion}
      />

      <TypedConfirmDialog
        open={!!m.deleteId}
        onClose={() => !m.pending && m.setDeleteId(null)}
        onConfirm={m.handleDelete}
        title={t("manager.deleteTitle")}
        description={t("manager.deleteConfirm")}
        expectedValue={m.localVersions.find((v) => v.id === m.deleteId)?.versionNumber || ""}
        expectedValueLabel={t("manager.confirmVersionLabel")}
        pending={m.pending}
      />

      <EditVersionDialog
        open={!!m.editTarget}
        onClose={() => m.setEditTarget(null)}
        version={m.editTarget}
        projectSlug={projectSlug}
        availablePlatforms={availablePlatforms}
        openIdeas={openIdeas}
        onSuccess={m.handleEditSuccess}
      />

      <AbstractDialog
        open={m.uploadOpen}
        onClose={() => m.setUploadOpen(false)}
        maxWidth="md"
        fullWidth
        title={t("manager.uploadTitle")}
        onCancel={() => m.setUploadOpen(false)}
        cancelText={tCommon("close")}
      >
        <Box sx={{ mt: 2 }}>
          <VersionUploadForm {...uploadContext} previousSettings={m.previousSettings} />
        </Box>
      </AbstractDialog>
    </Box>
  );
};

export default ProjectVersionsManager;
