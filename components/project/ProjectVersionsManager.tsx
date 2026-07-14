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
import AbstractDialog from "@/components/ui/AbstractDialog";
import DialogContentText from "@mui/material/DialogContentText";
import FormTextField from "@/components/ui/form/FormTextField";
import FormAutocomplete from "@/components/ui/form/FormAutocomplete";
import { AutocompleteRenderGetTagProps } from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { SyntheticEvent } from "react";
import { deleteVersion, updateVersion } from "@/lib/actions/version";
import { importGithubRelease } from "@/lib/actions/github";
import GitHubIcon from "@mui/icons-material/GitHub";
import { useFormatter, useTranslations } from "next-intl";
import TypedConfirmDialog from "@/components/ui/TypedConfirmDialog";
import VersionUploadForm from "@/components/project/VersionUploadForm";
import { MC_VERSIONS } from "@/lib/validations";
import { AVAILABLE_LOADERS, getLoaderInfo } from "@/lib/loaders";
import { RELEASE_CHANNELS, DEFAULT_RELEASE_CHANNEL } from "@/lib/releaseChannels";
import ReleaseChannelChip from "@/components/project/ReleaseChannelChip";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";

export interface ProjectVersion {
  id: string;
  versionNumber: string;
  mcVersions: string;
  loaders: string;
  createdAt: Date;
  downloads: number;
  changelog: string;
  releaseChannel: string;
}

export interface ProjectVersionsManagerProps {
  projectSlug: string;
  versions: ProjectVersion[];
  openIdeas: { id: string; title: string }[];
  availablePlatforms?: { slug: string; name: string }[];
  githubRepo?: string | null;
}

export default function ProjectVersionsManager({ projectSlug, versions: initialVersions, openIdeas, availablePlatforms = [], githubRepo }: ProjectVersionsManagerProps) {
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
  const [editError, setEditError] = useState<{ [key: string]: string[] } | null>(null);
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
    } catch (err: any) {
      setImportMsg({ text: err?.message || t("manager.importError"), severity: "error" });
    } finally {
      setImporting(false);
    }
  };

  const parsedVersions = useMemo(() => {
    return localVersions.map(v => {
      let mcvs: string[] = [];
      try { mcvs = JSON.parse(v.mcVersions) as string[]; } catch {}
      return { ...v, parsedMcVersions: mcvs, date: new Date(v.createdAt) };
    });
  }, [localVersions]);

  // Edit State
  const [editNumber, setEditNumber] = useState("");
  const [editChangelog, setEditChangelog] = useState("");
  const [editMc, setEditMc] = useState<string[]>([]);
  const [editLoaders, setEditLoaders] = useState<string[]>([]);
  const [editChannel, setEditChannel] = useState<string>(DEFAULT_RELEASE_CHANNEL);

  useEffect(() => {
    if (!searchParams) return;
    const editId = searchParams.get("editVersionId");
    if (editId) {
      const targetVersion = localVersions.find(v => v.id === editId);
      if (targetVersion) {
        openEdit(targetVersion);
        // Clean up the URL
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
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setLocalVersions(prev => prev.filter(v => v.id !== deleteId));
        setDeleteId(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete version");
    } finally {
      setPending(false);
    }
  };

  const openEdit = (v: ProjectVersion) => {
    setEditTarget(v);
    setEditNumber(v.versionNumber);
    setEditChangelog(v.changelog || "");
    setEditChannel(v.releaseChannel || DEFAULT_RELEASE_CHANNEL);
    try {
      setEditMc(JSON.parse(v.mcVersions) || []);
      setEditLoaders(JSON.parse(v.loaders) || []);
    } catch {
      setEditMc([]);
      setEditLoaders([]);
    }
    setEditError(null);
  };

  const handleEditSubmit = async (e?: SyntheticEvent<HTMLFormElement>) => {
    e?.preventDefault?.();
    if (!editTarget) return;
    setPending(true);
    setEditError(null);

    const formData = new FormData();
    formData.append("versionNumber", editNumber);
    formData.append("changelog", editChangelog);
    formData.append("releaseChannel", editChannel);
    editMc.forEach(mc => formData.append("mcVersions", mc));
    editLoaders.forEach(l => formData.append("loaders", l));

    try {
      const res = await updateVersion(editTarget.id, projectSlug, formData);
      if (res.error) {
        setEditError(res.error as any);
      } else {
        setLocalVersions(prev => prev.map(v => v.id === editTarget.id ? {
          ...v,
          versionNumber: editNumber,
          changelog: editChangelog,
          releaseChannel: editChannel,
          mcVersions: JSON.stringify(editMc),
          loaders: JSON.stringify(editLoaders)
        } : v));
        setEditTarget(null);
      }
    } catch(err: any) {
      setEditError({ server: [err.message] });
    } finally {
      setPending(false);
    }
  };

  return (
    <Box sx={{ width: "100%", overflow: "hidden" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="body2" color="text.secondary">
          {t("manager.description")}
        </Typography>
        <Stack direction="row" spacing={1}>
          {githubRepo && (
            <Button
              variant="outlined"
              startIcon={<GitHubIcon />}
              onClick={handleImportGithub}
              disabled={importing}
            >
              {importing ? t("manager.importing") : t("manager.importGithub")}
            </Button>
          )}
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setUploadOpen(true)}>
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
              return (
                <TableRow key={v.id}>
                  <TableCell sx={{ fontWeight: "bold" }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <span>{v.versionNumber}</span>
                      <ReleaseChannelChip channel={v.releaseChannel} />
                    </Stack>
                  </TableCell>
                  <TableCell>{v.parsedMcVersions.join(", ")}</TableCell>
                  <TableCell>{v.downloads}</TableCell>
                  <TableCell>
                    {format.dateTime(v.date, { dateStyle: "short", timeStyle: "short" })}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton color="primary" onClick={() => openEdit(v)}>
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

      {/* Edit Dialog */}
      <AbstractDialog 
        open={!!editTarget} 
        onClose={() => !pending && setEditTarget(null)} 
        maxWidth="sm" 
        fullWidth
        title={t("manager.editTitle")}
        onCancel={() => setEditTarget(null)}
        onConfirm={() => handleEditSubmit()}
        cancelText={tCommon("cancel")}
        confirmText={tCommon("save")}
        isSubmitting={pending}
      >
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3, pt: 2 }}>
          {editError?.server && <Alert severity="error">{editError.server[0]}</Alert>}
          
          <FormTextField
            label={t("fields.versionNumber")}
            value={editNumber}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditNumber(e.target.value)}
            fullWidth
            required
            size="small"
            error={!!editError?.versionNumber}
            helperText={editError?.versionNumber?.[0]}
            sx={{ mt: 1 }}
          />

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              {t("fields.releaseChannel")}
            </Typography>
            <ToggleButtonGroup
              color="primary"
              value={editChannel}
              exclusive
              onChange={(_, val) => { if (val) setEditChannel(val); }}
              size="small"
            >
              {RELEASE_CHANNELS.map((ch) => (
                <ToggleButton key={ch} value={ch}>{t(`channels.${ch}`)}</ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          <FormAutocomplete
            multiple
            options={MC_VERSIONS}
            value={editMc as any}
            onChange={(_, val) => setEditMc(val as string[])}
            renderInputProps={{ 
              label: t("fields.mcVersions"), 
              required: editMc.length === 0, 
              error: !!editError?.mcVersions, 
              helperText: editError?.mcVersions?.[0] as string | undefined
            }}
          />

          {/* @ts-ignore */}
          <FormAutocomplete
            multiple
            options={availablePlatforms}
            getOptionLabel={(option: any) => {
              if (typeof option === "string") return option;
              return option.name || option.slug || "";
            }}
            value={availablePlatforms.filter(p => editLoaders.includes(p.slug)) as any}
            onChange={(_, val: any[]) => setEditLoaders(val.map(v => typeof v === "string" ? v : v.slug))}
            renderInputProps={{ 
              label: t("fields.loaders"), 
              required: editLoaders.length === 0, 
              error: !!editError?.loaders, 
              helperText: editError?.loaders?.[0] as string | undefined
            }}
            // @ts-ignore
            renderTags={(val: any[], getTagProps: any) => val.map((option, idx) => {
              const slug = typeof option === "string" ? option : option.slug;
              const name = typeof option === "string" ? option : option.name;
              const info = getLoaderInfo(slug);
              const { key, ...tagProps } = getTagProps({ index: idx });
              return (
                <Chip 
                  key={key} 
                  label={name} 
                  size="small" 
                  color={info.color as any}
                  icon={info.icon}
                  {...tagProps} 
                />
              );
            })}
          />

          <FormTextField
            label={t("fields.changelog")}
            value={editChangelog}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditChangelog(e.target.value)}
            fullWidth
            multiline
            rows={4}
            error={!!editError?.changelog}
            helperText={editError?.changelog?.[0]}
          />
        </Box>
      </AbstractDialog>

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
}
