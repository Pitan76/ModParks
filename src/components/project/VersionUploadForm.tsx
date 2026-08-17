"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Autocomplete from "@mui/material/Autocomplete";
import CircularProgress from "@mui/material/CircularProgress";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { RELEASE_CHANNELS } from "@/lib/releaseChannels";
import { useTranslations } from "next-intl";
import LoaderAutocomplete from "./LoaderAutocomplete";
import McVersionAutocomplete from "./McVersionAutocomplete";
import PreviousVersionSettingsBanner, { type PreviousVersionSettings } from "./PreviousVersionSettings";
import type { VersionUploadContext } from "@/lib/queries/versionUploadContext";
import DependencyDraftEditor from "./DependencyDraftEditor";
import VersionFileInput from "./version/VersionFileInput";
import { useVersionUpload } from "./version/useVersionUpload";

/**
 * 前提データは {@link VersionUploadContext} に束ねて必須で受け取る。
 * 任意 props にすると入口が増えたときに渡し漏れても気づけない（実際に取りこぼした）。
 */
export type VersionUploadFormProps = VersionUploadContext & {
  /** 直前のバージョンの設定。渡された場合のみ流用ボタンを表示する */
  previousSettings?: PreviousVersionSettings | null;
};

/**
 * プロジェクトの新バージョン（ファイル）をアップロードするフォームコンポーネント。
 * R2への署名付きアップロードと、DBへのバージョン情報登録を行います。
 */
const VersionUploadForm = ({
  slug,
  openIdeas,
  availablePlatforms,
  previousSettings = null,
  modrinthSyncAvailable,
  curseforgeSyncAvailable,
}: VersionUploadFormProps) => {
  const tVersion = useTranslations("Version");
  const tCommon = useTranslations("Common");
  const form = useVersionUpload(slug, previousSettings);
  const { error } = form;
  const [selectedIdea, setSelectedIdea] = useState<{ id: string; title: string } | null>(null);

  const submitDisabled = form.pending || (form.uploadMode === "file" ? !form.file : !form.externalUrl);

  return (
    <Box
      component="form"
      onSubmit={form.handleSubmit}
      sx={{ display: "flex", flexDirection: "column", gap: 3, p: "2px" }}
    >
      {previousSettings && (
        <PreviousVersionSettingsBanner
          settings={previousSettings}
          applied={form.reuseApplied}
          onApply={form.handleReusePrevious}
        />
      )}

      <VersionFileInput
        uploadMode={form.uploadMode}
        onChangeMode={(mode) => { form.setUploadMode(mode); form.setError(null); }}
        file={form.file}
        fileInputRef={form.fileInputRef}
        onFileChange={form.handleFileChange}
        externalUrl={form.externalUrl}
        onChangeExternalUrl={form.setExternalUrl}
        extractRecipes={form.extractRecipes}
        onChangeExtractRecipes={form.setExtractRecipes}
        parsing={form.parsing}
        pending={form.pending}
        errorMessage={error?.fileUrl?.[0]}
      />

      {openIdeas.length > 0 && (
        <Autocomplete
          options={openIdeas}
          getOptionLabel={(option) => option.title}
          onChange={(_, newValue) => setSelectedIdea(newValue)}
          value={selectedIdea}
          renderInput={(params) => (
            <>
              <TextField
                {...params}
                label={tVersion("uploadForm.resolveIdea")}
                placeholder={tVersion("uploadForm.none")}
              />
              <input type="hidden" name="ideaId" value={selectedIdea?.id || ""} />
            </>
          )}
        />
      )}

      <TextField
        name="versionNumber"
        label={tVersion("uploadForm.versionNumberPlaceholder")}
        value={form.versionNumber}
        onChange={(e) => form.setVersionNumber(e.target.value)}
        fullWidth
        required
        error={!!error?.versionNumber}
        helperText={error?.versionNumber?.[0]}
      />

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          {tVersion("fields.releaseChannel")}
        </Typography>
        <ToggleButtonGroup
          color="primary"
          value={form.releaseChannel}
          exclusive
          onChange={(_, val) => { if (val) form.setReleaseChannel(val); }}
          aria-label="Release Channel"
          size="small"
        >
          {RELEASE_CHANNELS.map((ch) => (
            <ToggleButton key={ch} value={ch}>
              {tVersion(`channels.${ch}`)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      <McVersionAutocomplete
        value={form.mcVersions}
        onChange={form.setMcVersions}
        label={tVersion("fields.mcVersions")}
        error={!!error?.mcVersions}
        helperText={error?.mcVersions?.[0]}
        required={false}
      />

      <LoaderAutocomplete
        availablePlatforms={availablePlatforms}
        loaders={form.loaders}
        onChange={form.setLoaders}
        label={tVersion("fields.loaders")}
        error={!!error?.loaders}
        helperText={error?.loaders?.[0]}
        required={false}
      />

      <TextField
        name="changelog"
        label={tVersion("fields.changelog")}
        multiline
        rows={5}
        fullWidth
        error={!!error?.changelog}
        helperText={error?.changelog?.[0]}
      />

      {(modrinthSyncAvailable || curseforgeSyncAvailable) && (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            {tVersion("uploadForm.crosspostTitle")}
          </Typography>
          {modrinthSyncAvailable && (
            <FormControlLabel
              control={<Checkbox checked={form.uploadToModrinth} onChange={(e) => form.setUploadToModrinth(e.target.checked)} />}
              label={tVersion("uploadForm.crosspostModrinth")}
            />
          )}
          {curseforgeSyncAvailable && (
            <FormControlLabel
              control={<Checkbox checked={form.uploadToCurseforge} onChange={(e) => form.setUploadToCurseforge(e.target.checked)} />}
              label={tVersion("uploadForm.crosspostCurseforge")}
            />
          )}
        </Box>
      )}

      {form.externalResult && (
        <Alert
          severity="warning"
          action={
            <Button color="inherit" size="small" onClick={() => form.router.push(`/projects/${slug}`)}>
              {tCommon("close")}
            </Button>
          }
        >
          {form.externalResult.modrinth && !form.externalResult.modrinth.ok && (
            <div>{tVersion("uploadForm.crosspostModrinthFailed", { error: form.externalResult.modrinth.error })}</div>
          )}
          {form.externalResult.curseforge && !form.externalResult.curseforge.ok && (
            <div>{tVersion("uploadForm.crosspostCurseforgeFailed", { error: form.externalResult.curseforge.error })}</div>
          )}
        </Alert>
      )}

      <Box>
        <DependencyDraftEditor
          value={form.dependencies}
          onChange={form.setDependencies}
          disabled={form.pending}
        />
        {error?.dependencies && (
          <Typography variant="caption" color="error" sx={{ display: "block", mt: 1 }}>
            {error.dependencies[0]}
          </Typography>
        )}
      </Box>

      <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end", gap: 2 }}>
        <Button variant="outlined" onClick={() => form.router.back()} disabled={form.pending}>
          {tCommon("cancel")}
        </Button>
        <Button type="submit" variant="contained" disabled={submitDisabled}>
          {form.pending ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CircularProgress size={24} color="inherit" />
              {form.extracting && tVersion("uploadForm.extracting")}
            </Box>
          ) : (
            tVersion("uploadForm.publish")
          )}
        </Button>
      </Box>
    </Box>
  );
};

export default VersionUploadForm;
