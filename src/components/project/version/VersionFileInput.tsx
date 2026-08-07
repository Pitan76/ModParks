"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import LinkIcon from "@mui/icons-material/Link";
import { useTranslations } from "next-intl";
import type { ChangeEvent, RefObject } from "react";
import type { UploadMode } from "./useVersionUpload";

export type VersionFileInputProps = {
  uploadMode: UploadMode;
  onChangeMode: (mode: UploadMode) => void;
  file: File | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  externalUrl: string;
  onChangeExternalUrl: (url: string) => void;
  extractRecipes: boolean;
  onChangeExtractRecipes: (value: boolean) => void;
  parsing: boolean;
  pending: boolean;
  /** fileUrl フィールドのエラー文言 */
  errorMessage?: string;
};

/**
 * バージョンの実体（アップロードファイル / 外部URL）を指定する入力欄。
 * どちらの方式でも最終的に fileUrl 1つに収束するため、エラー表示も共通で扱う。
 */
const VersionFileInput = ({
  uploadMode,
  onChangeMode,
  file,
  fileInputRef,
  onFileChange,
  externalUrl,
  onChangeExternalUrl,
  extractRecipes,
  onChangeExtractRecipes,
  parsing,
  pending,
  errorMessage,
}: VersionFileInputProps) => {
  const tVersion = useTranslations("Version");

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
        {tVersion("uploadForm.uploadMode")}
      </Typography>
      <ToggleButtonGroup
        color="primary"
        value={uploadMode}
        exclusive
        onChange={(_, val) => { if (val) onChangeMode(val); }}
        aria-label="Upload Mode"
        fullWidth
        size="small"
        sx={{ mb: 2 }}
      >
        <ToggleButton value="file" aria-label="Upload File">
          <CloudUploadIcon sx={{ mr: 1, fontSize: 20 }} /> {tVersion("uploadForm.modeFile")}
        </ToggleButton>
        <ToggleButton value="url" aria-label="External URL">
          <LinkIcon sx={{ mr: 1, fontSize: 20 }} /> {tVersion("uploadForm.modeUrl")}
        </ToggleButton>
      </ToggleButtonGroup>

      {uploadMode === "file" ? (
        <Box sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 1, p: 3, textAlign: "center", bgcolor: "background.paper" }}>
          <Button variant="outlined" onClick={() => fileInputRef.current?.click()} disabled={pending || parsing}>
            {tVersion("uploadForm.fileSelect")}
            <input type="file" hidden accept=".jar,.zip" ref={fileInputRef} onChange={onFileChange} />
          </Button>
          {parsing && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "center", justifyContent: "center", mt: 1, gap: 1 }}>
              <CircularProgress size={16} /> {tVersion("uploadForm.parsingJar")}
            </Typography>
          )}
          {file && !parsing && (
            <Typography variant="caption" color="success.main" sx={{ display: "block", mt: 1 }}>
              {tVersion("uploadForm.selectedFile", { name: file.name, size: (file.size / 1024 / 1024).toFixed(2) })}
            </Typography>
          )}
          {file && (
            <Box sx={{ mt: 2 }}>
              <FormControlLabel
                control={<Switch checked={extractRecipes} onChange={(e) => onChangeExtractRecipes(e.target.checked)} />}
                label={tVersion("uploadForm.extractRecipes")}
              />
            </Box>
          )}
          {errorMessage && (
            <Typography color="error" variant="caption" sx={{ display: "block", mt: 1 }}>{errorMessage}</Typography>
          )}
        </Box>
      ) : (
        <TextField
          name="externalUrl"
          label={tVersion("uploadForm.externalUrl")}
          value={externalUrl}
          onChange={(e) => onChangeExternalUrl(e.target.value)}
          fullWidth
          required
          error={!!errorMessage}
          helperText={errorMessage || tVersion("uploadForm.externalUrlHelper")}
        />
      )}
    </Box>
  );
};

export default VersionFileInput;
