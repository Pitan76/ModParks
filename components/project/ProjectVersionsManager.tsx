"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import IconButton from "@mui/material/IconButton";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import CircularProgress from "@mui/material/CircularProgress";
import ArchiveIcon from "@mui/icons-material/Archive";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import Tooltip from "@mui/material/Tooltip";
import AbstractDialog from "@/components/ui/AbstractDialog";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { deleteVersion, setVersionArchived } from "@/lib/actions/version";
import { extractRecipesFromVersion } from "@/lib/actions/versionRecipe";
import { importGithubRelease } from "@/lib/actions/github";
import GitHubIcon from "@mui/icons-material/GitHub";
import { useFormatter, useTranslations } from "next-intl";
import TypedConfirmDialog from "@/components/ui/TypedConfirmDialog";
import VersionUploadForm from "@/components/project/VersionUploadForm";
import { normalizeReleaseChannel } from "@/lib/releaseChannels";
import ReleaseChannelChip from "@/components/project/ReleaseChannelChip";
import EditVersionDialog from "./EditVersionDialog";

export type ProjectVersion = {
  id: string;
  versionNumber: string;
  mcVersions: string;
  loaders: string;
  createdAt: Date;
  downloads: number;
  changelog: string;
  releaseChannel: string;
  fileUrl: string;
  archivedAt?: Date | null;
  isExternal?: boolean;
  canExtractRecipes?: boolean;
};

type OptionItem = {
  slug: string;
  name: string;
};

export type ProjectVersionsManagerProps = {
  projectSlug: string;
  versions: ProjectVersion[];
  openIdeas: { id: string; title: string }[];
  availablePlatforms?: OptionItem[];
  githubRepo?: string | null;
};

/**
 * プロジェクト詳細の管理画面において、リリースされたバージョンの一覧と管理機能（アーカイブ、削除、編集、レシピ抽出、Githubインポート）を提供するコンポーネント。
 */
const ProjectVersionsManager = ({
  projectSlug,
  versions: initialVersions,
  openIdeas,
  availablePlatforms = [],
  githubRepo
}: ProjectVersionsManagerProps) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const format = useFormatter();
  const tCommon = useTranslations("Common");
  const t = useTranslations("Version");
  const [localVersions, setLocalVersions] = useState(initialVersions);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<ProjectVersion | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ text: string; severity: "success" | "error" } | null>(null);

  const handleImportGithub = async () => {
    setImporting(true);
    setImportMsg(null);
    try {
      const res = await importGithubRelease(projectSlug);
      if ("error" in res) {
        setImportMsg({ text: res.error, severity: "error" });
      } else {
        setImportMsg({ text: t("manager.importSuccess", { version: res.versionNumber }), severity: "success" });
        router.refresh();
      }
    } catch (err: unknown) {
      setImportMsg({ text: err instanceof Error ? err.message : t("manager.importError"), severity: "error" });
    } finally {
      setImporting(false);
    }
  };

  const parsedVersions = useMemo(() => {
    return localVersions.map(v => {
      let mcvs: string[] = [];
      try {
        mcvs = JSON.parse(v.mcVersions) as string[];
      } catch {}
      return {
        ...v,
        releaseChannel: normalizeReleaseChannel(v.releaseChannel),
        parsedMcVersions: mcvs,
        date: new Date(v.createdAt)
      };
    });
  }, [localVersions]);

  useEffect(() => {
    if (!searchParams) return;
    const editId = searchParams.get("editVersionId");
    if (editId) {
      const targetVersion = localVersions.find(v => v.id === editId);
      if (targetVersion) {
        setEditTarget(targetVersion);
        const params = new URLSearchParams(searchParams.toString());
        params.delete("editVersionId");
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }
    }
  }, [searchParams, localVersions, pathname, router]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setPending(true);
    setErrorMsg("");

    try {
      const res = await deleteVersion(deleteId, projectSlug);
      if ("error" in res) {
        setErrorMsg(res.error || "Failed to delete version");
      } else {
        setLocalVersions(prev => prev.filter(v => v.id !== deleteId));
        setDeleteId(null);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to delete version");
    } finally {
      setPending(false);
    }
  };

  const [extractingId, setExtractingId] = useState<string | null>(null);

  const handleExtractRecipes = async (versionId: string) => {
    setExtractingId(versionId);
    setErrorMsg("");
    setImportMsg(null);
    try {
      const res = await extractRecipesFromVersion(versionId, projectSlug);
      if ("error" in res) {
        setErrorMsg(res.error || "Failed to extract recipes");
      } else {
        setImportMsg({ text: t("manager.extractSuccess", { count: res.count }), severity: "success" });
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to extract recipes");
    } finally {
      setExtractingId(null);
    }
  };

  const [archivingId, setArchivingId] = useState<string | null>(null);

  const handleToggleArchive = async (v: ProjectVersion) => {
    const nextArchived = !v.archivedAt;
    setArchivingId(v.id);
    setErrorMsg("");
    try {
      const res = await setVersionArchived(v.id, projectSlug, nextArchived);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setLocalVersions(prev => prev.map(item => item.id === v.id ? { ...item, archivedAt: nextArchived ? new Date() : null } : item));
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to archive version");
    } finally {
      setArchivingId(null);
    }
  };

  const handleEditSuccess = (updated: ProjectVersion) => {
    setLocalVersions(prev => prev.map(v => v.id === updated.id ? updated : v));
  };

  return (
    <Box sx={{ width: "100%", overflow: "hidden" }}>
      <Box sx={{ 
        display: "flex", 
        flexDirection: { xs: "column", md: "row" }, 
        justifyContent: "space-between", 
        alignItems: { xs: "stretch", md: "center" }, 
        gap: 2, 
        mb: 3 
      }}>
        <Typography variant="body2" color="text.secondary">
          {t("manager.description")}
        </Typography>
        <Stack 
          direction={{ xs: "column", sm: "row" }} 
          spacing={1} 
          sx={{ 
            width: { xs: "100%", md: "auto" },
            alignItems: { xs: "stretch", sm: "center" },
            flexShrink: 0
          }}
        >
          {githubRepo && (
            <Button
              variant="outlined"
              startIcon={<GitHubIcon />}
              onClick={handleImportGithub}
              disabled={importing}
              sx={{ whiteSpace: "nowrap" }}
            >
              {importing ? t("manager.importing") : t("manager.importGithub")}
            </Button>
          )}
          <Button 
            variant="contained" 
            startIcon={<AddIcon />} 
            onClick={() => setUploadOpen(true)}
            sx={{ whiteSpace: "nowrap" }}
          >
            {t("manager.addVersion")}
          </Button>
        </Stack>
      </Box>

      {importMsg && <Alert severity={importMsg.severity} sx={{ mb: 3 }} onClose={() => setImportMsg(null)}>{importMsg.text}</Alert>}
      {errorMsg && <Alert severity="error" sx={{ mb: 3 }}>{errorMsg}</Alert>}

      <TableContainer component={Paper} variant="outlined" sx={{ width: "100%", maxWidth: "100%", overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow>
              <TableCell>{t("manager.columns.version")}</TableCell>
              <TableCell>{t("manager.columns.mc")}</TableCell>
              <TableCell>{t("manager.columns.downloads")}</TableCell>
              <TableCell>{t("manager.columns.date")}</TableCell>
              <TableCell align="right">{t("manager.columns.actions")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {parsedVersions.map((v) => {
              const isArchived = !!v.archivedAt;
              return (
                <TableRow key={v.id} sx={isArchived ? { opacity: 0.6, bgcolor: "action.hover" } : undefined}>
                  <TableCell sx={{ fontWeight: "bold" }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                      <span>{v.versionNumber}</span>
                      <ReleaseChannelChip channel={v.releaseChannel} />
                      {isArchived && (
                        <Chip label={t("manager.archivedLabel")} size="small" color="default" variant="outlined" />
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>{v.parsedMcVersions.join(", ")}</TableCell>
                  <TableCell>{v.downloads}</TableCell>
                  <TableCell>
                    {format.dateTime(v.date, { dateStyle: "short", timeStyle: "short" })}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={t("manager.extractRecipes")}>
                      <span>
                        <IconButton 
                          color="secondary" 
                          onClick={() => handleExtractRecipes(v.id)} 
                          disabled={!!extractingId || !v.canExtractRecipes}
                        >
                          {extractingId === v.id ? <CircularProgress size={24} color="inherit" /> : <AutoFixHighIcon />}
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={isArchived ? t("manager.unarchive") : t("manager.archive")}>
                      <span>
                        <IconButton
                          color="default"
                          onClick={() => handleToggleArchive(v)}
                          disabled={archivingId === v.id}
                        >
                          {isArchived ? <UnarchiveIcon /> : <ArchiveIcon />}
                        </IconButton>
                      </span>
                    </Tooltip>
                    <IconButton color="primary" onClick={() => setEditTarget(v)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton color="error" onClick={() => setDeleteId(v.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
            {localVersions.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3, color: "text.secondary" }}>
                  {t("manager.noVersions")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TypedConfirmDialog
        open={!!deleteId}
        onClose={() => !pending && setDeleteId(null)}
        onConfirm={handleDelete}
        title={t("manager.deleteTitle")}
        description={t("manager.deleteConfirm")}
        expectedValue={localVersions.find(v => v.id === deleteId)?.versionNumber || ""}
        expectedValueLabel={t("manager.confirmVersionLabel")}
        pending={pending}
      />

      <EditVersionDialog
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        version={editTarget}
        projectSlug={projectSlug}
        availablePlatforms={availablePlatforms}
        onSuccess={handleEditSuccess}
      />

      {/* Upload Dialog */}
      <AbstractDialog 
        open={uploadOpen} 
        onClose={() => setUploadOpen(false)} 
        maxWidth="md" 
        fullWidth
        title={t("manager.uploadTitle")}
        onCancel={() => setUploadOpen(false)}
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
