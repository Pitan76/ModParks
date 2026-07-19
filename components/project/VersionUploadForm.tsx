"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Autocomplete, { AutocompleteRenderGetTagProps } from "@mui/material/Autocomplete";
import CircularProgress from "@mui/material/CircularProgress";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import LinkIcon from "@mui/icons-material/Link";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createVersion } from "@/lib/actions/version";
import { getLoaderInfo } from "@/lib/loaders";
import { MC_VERSIONS } from "@/lib/validations";
import { RELEASE_CHANNELS, DEFAULT_RELEASE_CHANNEL } from "@/lib/releaseChannels";
import { parseModJar } from "@/lib/utils/modParser";
import { uploadFileToR2 } from "@/lib/utils/upload";

import { useTranslations } from "next-intl";

/**
 * プロジェクトの新バージョン（ファイル）をアップロードするフォームコンポーネント。
 * R2への署名付きアップロードと、DBへのバージョン情報登録を行います。
 */
export interface VersionUploadFormProps {
  /** バージョンを追加する対象のプロジェクトSlug */
  slug: string;
  /** 関連付け可能なオープン状態のアイデア一覧 */
  openIdeas: { id: string; title: string }[];
  availablePlatforms?: { slug: string; name: string }[];
}

export default function VersionUploadForm({ slug, openIdeas, availablePlatforms = [] }: VersionUploadFormProps) {
  const router = useRouter();
  const tVersion = useTranslations("Version");
  const tCommon = useTranslations("Common");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ [key: string]: string[] } | null>(null);
  
  const [mcVersions, setMcVersions] = useState<string[]>([]);
  const [loaders, setLoaders] = useState<string[]>([]);
  const [uploadMode, setUploadMode] = useState<"file" | "url">("file");
  const [file, setFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState("");
  const [versionNumber, setVersionNumber] = useState("");
  const [releaseChannel, setReleaseChannel] = useState<string>(DEFAULT_RELEASE_CHANNEL);
  const [extractRecipes, setExtractRecipes] = useState(true);
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    if (!selectedFile) return;

    setParsing(true);
    try {
      const { detectedVersion, detectedLoaders, detectedMcVersions } = await parseModJar(selectedFile);

      if (detectedVersion) setVersionNumber(detectedVersion);
      
      if (detectedLoaders.length > 0) {
        setLoaders(detectedLoaders);
      }

      if (detectedMcVersions.length > 0) {
        setMcVersions((prev) => Array.from(new Set([...prev, ...detectedMcVersions])));
      }
    } catch (err) {
      console.error("Failed to read JAR/ZIP", err);
    } finally {
      setParsing(false);
    }
  };

  /**
   * フォーム送信処理。
   * 1. 署名付きURLの取得
   * 2. R2ストレージへのファイルアップロード
   * 3. DBへのバージョン登録 (Server Action)
   */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (uploadMode === "file" && !file) {
      setError({ fileUrl: [tVersion("uploadForm.error.fileRequired")] });
      return;
    }
    if (uploadMode === "url" && !externalUrl) {
      setError({ fileUrl: [tVersion("uploadForm.error.fileRequired")] });
      return;
    }

    setPending(true);
    setError(null);

    try {
      const formData = new FormData(e.currentTarget);
      
      // SelectやAutocompleteのデフォルトのHidden Inputによって値が不正なカンマ区切りになるのを防ぐため、
      // 既存の値を一度削除してから手動で追加し直します
      formData.delete("mcVersions");
      formData.delete("loaders");
      
      mcVersions.forEach(v => formData.append("mcVersions", v));
      loaders.forEach(l => formData.append("loaders", l));
      formData.set("releaseChannel", releaseChannel);
      formData.set("extractRecipes", extractRecipes ? "true" : "false");

      if (uploadMode === "file" && file) {
        if (file.size > 5 * 1024 * 1024) {
          setError({ fileUrl: [tVersion("uploadForm.error.fileTooLarge")] });
          setPending(false);
          return;
        }

        const { publicUrl } = await uploadFileToR2(file, { type: "mod", projectSlug: slug }, {
          uploadError: tVersion("uploadForm.error.uploadFailed"),
        });

        formData.append("fileUrl", publicUrl);
        formData.append("fileName", file.name);
        formData.append("fileSize", file.size.toString());
      } else {
        // External URL
        formData.append("fileUrl", externalUrl);
        formData.append("fileName", externalUrl.split('/').pop() || "external-file");
      }

      const result = await createVersion(slug, formData);
      
      if (result && result.error) {
        setError(result.error as { [key: string]: string[] });
        setPending(false);
      } else {
        router.push(`/projects/${slug}`);
      }
    } catch (err: any) {
      console.error(err);
      setError({ fileUrl: [err.message || tVersion("uploadForm.error.uploadError")] });
    } finally {
      setPending(false);
    }
  };

  return (
    <Card>
      <CardContent sx={{ p: 4 }}>
        <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              {tVersion("uploadForm.uploadMode")}
            </Typography>
            <ToggleButtonGroup
              color="primary"
              value={uploadMode}
              exclusive
              onChange={(_, val) => { if (val) setUploadMode(val); setError(null); }}
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
                  <input type="file" hidden accept=".jar,.zip" ref={fileInputRef} onChange={handleFileChange} />
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
                      control={<Switch checked={extractRecipes} onChange={(e) => setExtractRecipes(e.target.checked)} />}
                      label={tVersion("uploadForm.extractRecipes", "JARからレシピを抽出してアップロード")}
                    />
                  </Box>
                )}
                {error?.fileUrl && <Typography color="error" variant="caption" sx={{ display: "block", mt: 1 }}>{error.fileUrl[0]}</Typography>}
              </Box>
            ) : (
              <TextField
                name="externalUrl"
                label={tVersion("uploadForm.externalUrl")}
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                fullWidth
                required
                error={!!error?.fileUrl}
                helperText={error?.fileUrl?.[0] || tVersion("uploadForm.externalUrlHelper")}
              />
            )}
          </Box>

          {openIdeas.length > 0 && (
            <Autocomplete
              options={openIdeas}
              getOptionLabel={(option) => option.title}
              onChange={(_, newValue) => {
                // To keep compatibility with form submission, we can use a hidden input or name property.
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  name="ideaId"
                  label={tVersion("uploadForm.resolveIdea")}
                  placeholder={tVersion("uploadForm.none")}
                />
              )}
            />
          )}

          <TextField
            name="versionNumber"
            label={tVersion("uploadForm.versionNumberPlaceholder")}
            value={versionNumber}
            onChange={(e) => setVersionNumber(e.target.value)}
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
              value={releaseChannel}
              exclusive
              onChange={(_, val) => { if (val) setReleaseChannel(val); }}
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

          <Autocomplete
            multiple
            disableCloseOnSelect
            options={MC_VERSIONS as unknown as string[]}
            value={mcVersions}
            onChange={(_, newValue) => setMcVersions(newValue)}
            // @ts-expect-error MUI typing issue with renderTags signature resolution
            renderTags={(value: string[], getTagProps: AutocompleteRenderGetTagProps) =>
              value.map((option: string, index: number) => {
                const { key, ...tagProps } = getTagProps({ index });
                return (
                  <Chip variant="outlined" label={option} size="small" {...tagProps} key={key} />
                );
              })
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label={tVersion("fields.mcVersions")}
                error={!!error?.mcVersions}
                helperText={error?.mcVersions?.[0]}
                required={mcVersions.length === 0}
              />
            )}
          />

          <Autocomplete
            multiple
            disableCloseOnSelect
            options={availablePlatforms}
            getOptionLabel={(option) => {
              if (typeof option === "string") return option;
              return option.name || option.slug || "";
            }}
            value={availablePlatforms.filter(p => loaders.includes(p.slug)) as any}
            onChange={(_, newValue: any[]) => setLoaders(newValue.map(v => typeof v === "string" ? v : v.slug))}
            renderOption={(props: React.HTMLAttributes<HTMLLIElement>, option: any) => {
              const slug = typeof option === "string" ? option : option.slug;
              const name = typeof option === "string" ? option : option.name;
              const info = getLoaderInfo(slug);
              return (
                <li {...props} key={slug}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {info.icon}
                    {name}
                  </Box>
                </li>
              );
            }}
            // @ts-ignore
            renderTags={(val: any[], getTagProps: any) => val.map((option, index: number) => {
                const slug = typeof option === "string" ? option : option.slug;
                const name = typeof option === "string" ? option : option.name;
                const info = getLoaderInfo(slug);
                const { key, ...tagProps } = getTagProps({ index });
                return (
                  <Chip
                    variant="outlined"
                    label={name}
                    size="small"
                    icon={info.icon}
                    color={info.color}
                    {...tagProps}
                    key={key}
                  />
                );
              })
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label={tVersion("fields.loaders")}
                error={!!error?.loaders}
                helperText={error?.loaders?.[0]}
                required={loaders.length === 0}
              />
            )}
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


          <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end", gap: 2 }}>
            <Button variant="outlined" onClick={() => router.back()} disabled={pending}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" variant="contained" disabled={pending || (uploadMode === "file" ? !file : !externalUrl)}>
              {pending ? <CircularProgress size={24} color="inherit" /> : tVersion("uploadForm.publish")}
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
