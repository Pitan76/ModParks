"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import AddIcon from "@mui/icons-material/Add";
import GitHubIcon from "@mui/icons-material/GitHub";
import AbstractDialog from "@/components/ui/AbstractDialog";
import { useTranslations } from "next-intl";
import TypedConfirmDialog from "@/components/ui/TypedConfirmDialog";
import VersionUploadForm from "@/components/project/VersionUploadForm";
import EditVersionDialog from "./EditVersionDialog";
import VersionsManagerTable from "./VersionsManagerTable";
import { useVersionsManager, type ProjectVersion } from "./useVersionsManager";

export type { ProjectVersion } from "./useVersionsManager";

type OptionItem = { slug: string; name: string };

export type ProjectVersionsManagerProps = {
  projectSlug: string;
  versions: ProjectVersion[];
  openIdeas: { id: string; title: string }[];
  availablePlatforms?: OptionItem[];
  githubRepo?: string | null;
};

/**
 * プロジェクト詳細の管理画面で、リリースされたバージョンの一覧と管理機能
 * （アーカイブ、削除、編集、レシピ抽出、Githubインポート）を提供する。
 */
const ProjectVersionsManager = ({
  projectSlug,
  versions: initialVersions,
  openIdeas,
  availablePlatforms = [],
  githubRepo,
}: ProjectVersionsManagerProps) => {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Version");
  const m = useVersionsManager(projectSlug, initialVersions);

  return (
    <Box sx={{ width: "100%", overflow: "hidden" }}>
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "stretch", md: "center" },
          gap: 2,
          mb: 3,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {t("manager.description")}
        </Typography>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ width: { xs: "100%", md: "auto" }, alignItems: { xs: "stretch", sm: "center" }, flexShrink: 0 }}
        >
          {githubRepo && (
            <Button
              variant="outlined"
              startIcon={<GitHubIcon />}
              onClick={m.handleImportGithub}
              disabled={m.importing}
              sx={{ whiteSpace: "nowrap" }}
            >
              {m.importing ? t("manager.importing") : t("manager.importGithub")}
            </Button>
          )}
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => m.setUploadOpen(true)} sx={{ whiteSpace: "nowrap" }}>
            {t("manager.addVersion")}
          </Button>
        </Stack>
      </Box>

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
        onExtract={m.handleExtractRecipes}
        onToggleArchive={m.handleToggleArchive}
        onEdit={m.setEditTarget}
        onDelete={m.setDeleteId}
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
          <VersionUploadForm slug={projectSlug} openIdeas={openIdeas} availablePlatforms={availablePlatforms} />
        </Box>
      </AbstractDialog>
    </Box>
  );
};

export default ProjectVersionsManager;
