import { useState, useEffect } from "react";
import type { ChangeEvent, SyntheticEvent } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import AbstractDialog from "@/components/ui/AbstractDialog";
import FormTextField from "@/components/ui/form/FormTextField";
import FormAutocomplete from "@/components/ui/form/FormAutocomplete";
import LoaderAutocomplete from "./LoaderAutocomplete";
import { updateVersion } from "@/lib/actions/version";
import { MC_VERSIONS } from "@/lib/validations";
import { RELEASE_CHANNELS, DEFAULT_RELEASE_CHANNEL } from "@/lib/releaseChannels";
import { useTranslations } from "next-intl";
import type { ProjectVersion } from "./ProjectVersionsManager";

type OptionItem = {
  slug: string;
  name: string;
};

export type EditVersionDialogProps = {
  open: boolean;
  onClose: () => void;
  version: ProjectVersion | null;
  projectSlug: string;
  availablePlatforms: OptionItem[];
  onSuccess: (updated: ProjectVersion) => void;
};

/**
 * プロジェクトのバージョン情報を編集するダイアログコンポーネント。
 */
const EditVersionDialog = ({
  open,
  onClose,
  version,
  projectSlug,
  availablePlatforms,
  onSuccess
}: EditVersionDialogProps) => {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Version");

  const [pending, setPending] = useState(false);
  const [editError, setEditError] = useState<{ [key: string]: string[] } | null>(null);

  const [editNumber, setEditNumber] = useState("");
  const [editChangelog, setEditChangelog] = useState("");
  const [editMc, setEditMc] = useState<string[]>([]);
  const [editLoaders, setEditLoaders] = useState<string[]>([]);
  const [editChannel, setEditChannel] = useState<string>(DEFAULT_RELEASE_CHANNEL);
  const [editFileUrl, setEditFileUrl] = useState<string>("");
  const [isExternalEdit, setIsExternalEdit] = useState<boolean>(false);

  useEffect(() => {
    if (version) {
      setEditNumber(version.versionNumber);
      setEditChangelog(version.changelog || "");
      setEditChannel(version.releaseChannel);
      const isExternal = !!version.isExternal;
      setIsExternalEdit(isExternal);
      setEditFileUrl(isExternal ? version.fileUrl : "");
      try {
        setEditMc(JSON.parse(version.mcVersions) || []);
        setEditLoaders(JSON.parse(version.loaders) || []);
      } catch {
        setEditMc([]);
        setEditLoaders([]);
      }
      setEditError(null);
    }
  }, [version]);

  const handleEditSubmit = async (e?: SyntheticEvent<HTMLFormElement>) => {
    e?.preventDefault?.();
    if (!version) return;
    setPending(true);
    setEditError(null);

    const formData = new FormData();
    formData.append("versionNumber", editNumber);
    formData.append("changelog", editChangelog);
    formData.append("releaseChannel", editChannel);
    editMc.forEach((mc) => formData.append("mcVersions", mc));
    editLoaders.forEach((l) => formData.append("loaders", l));
    if (isExternalEdit && editFileUrl) {
      formData.append("fileUrl", editFileUrl);
    }

    try {
      const res = await updateVersion(version.id, projectSlug, formData);
      if (res.error) {
        setEditError(res.error as any);
      } else {
        onSuccess({
          ...version,
          versionNumber: editNumber,
          changelog: editChangelog,
          releaseChannel: editChannel,
          mcVersions: JSON.stringify(editMc),
          loaders: JSON.stringify(editLoaders),
          ...(isExternalEdit ? { fileUrl: editFileUrl } : {})
        });
        onClose();
      }
    } catch (err: unknown) {
      setEditError({ server: [err instanceof Error ? err.message : "Failed to update version"] });
    } finally {
      setPending(false);
    }
  };

  return (
    <AbstractDialog 
      open={open && !!version} 
      onClose={() => !pending && onClose()} 
      maxWidth="sm" 
      fullWidth
      title={t("manager.editTitle")}
      onCancel={onClose}
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
          onChange={(e: ChangeEvent<HTMLInputElement>) => setEditNumber(e.target.value)}
          fullWidth
          required
          size="small"
          error={!!editError?.versionNumber}
          helperText={editError?.versionNumber?.[0]}
          sx={{ mt: 1 }}
        />

        {isExternalEdit && (
          <FormTextField
            label={t("fields.fileUrl")}
            value={editFileUrl}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setEditFileUrl(e.target.value)}
            fullWidth
            required
            size="small"
            error={!!editError?.fileUrl}
            helperText={editError?.fileUrl?.[0]}
            sx={{ mt: 1 }}
          />
        )}

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            {t("fields.releaseChannel")}
          </Typography>
          <ToggleButtonGroup
            color="primary"
            value={editChannel}
            exclusive
            onChange={(_, val) => {
              if (val) setEditChannel(val);
            }}
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
            helperText: editError?.mcVersions?.[0]
          }}
        />

        <LoaderAutocomplete
          availablePlatforms={availablePlatforms}
          loaders={editLoaders}
          onChange={setEditLoaders}
          label={t("fields.loaders")}
          error={!!editError?.loaders}
          helperText={editError?.loaders?.[0]}
        />

        <FormTextField
          label={t("fields.changelog")}
          value={editChangelog}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setEditChangelog(e.target.value)}
          fullWidth
          multiline
          rows={4}
          error={!!editError?.changelog}
          helperText={editError?.changelog?.[0]}
        />
      </Box>
    </AbstractDialog>
  );
};

export default EditVersionDialog;
