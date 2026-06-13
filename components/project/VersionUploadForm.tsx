"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import OutlinedInput from "@mui/material/OutlinedInput";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import CircularProgress from "@mui/material/CircularProgress";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createVersion } from "@/lib/actions/version";
import { AVAILABLE_LOADERS, getLoaderInfo } from "@/lib/loaders";
import { MC_VERSIONS } from "@/lib/validations";
import { parseModJar } from "@/lib/utils/modParser";

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
}

export default function VersionUploadForm({ slug, openIdeas }: VersionUploadFormProps) {
  const router = useRouter();
  const tVersion = useTranslations("Version");
  const tCommon = useTranslations("Common");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ [key: string]: string[] } | null>(null);
  
  const [mcVersions, setMcVersions] = useState<string[]>([]);
  const [loaders, setLoaders] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [versionNumber, setVersionNumber] = useState("");
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
    if (!file) {
      setError({ fileUrl: [tVersion("uploadForm.error.fileRequired")] });
      return;
    }

    setPending(true);
    setError(null);

    try {
      const presignRes = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || "application/java-archive",
          type: "mod",
          projectSlug: slug,
        }),
      });

      if (!presignRes.ok) {
        const d = await presignRes.json();
        throw new Error(d.error || "Presign failed");
      }

      const { uploadUrl, publicUrl } = await presignRes.json();

      const arrayBuffer = await file.arrayBuffer();
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/java-archive" },
        body: arrayBuffer,
      });

      if (!uploadRes.ok) {
        throw new Error(tVersion("uploadForm.error.uploadFailed"));
      }

      const formData = new FormData(e.currentTarget);
      mcVersions.forEach(v => formData.append("mcVersions", v));
      loaders.forEach(l => formData.append("loaders", l));
      
      formData.append("fileUrl", publicUrl);
      formData.append("fileName", file.name);
      formData.append("fileSize", file.size.toString());

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
          <Box sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 1, p: 3, textAlign: "center", bgcolor: "background.paper" }}>
            <Button variant="outlined" onClick={() => fileInputRef.current?.click()} disabled={pending || parsing}>
              {tVersion("uploadForm.fileSelect")}
              <input type="file" hidden accept=".jar,.zip" ref={fileInputRef} onChange={handleFileChange} />
            </Button>
            {parsing && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={16} /> {tVersion("uploadForm.parsingJar")}
              </Typography>
            )}
            {file && !parsing && (
              <Typography variant="caption" color="success.main">
                {tVersion("uploadForm.selectedFile", { name: file.name, size: (file.size / 1024 / 1024).toFixed(2) })}
              </Typography>
            )}
            {error?.fileUrl && <Typography color="error" variant="caption" sx={{ display: "block", mt: 1 }}>{error.fileUrl[0]}</Typography>}
          </Box>

          {openIdeas.length > 0 && (
            <FormControl fullWidth size="small">
              <InputLabel>{tVersion("uploadForm.resolveIdea")}</InputLabel>
              <Select
                name="ideaId"
                label={tVersion("uploadForm.resolveIdea")}
                defaultValue=""
              >
                <MenuItem value="">{tVersion("uploadForm.none")}</MenuItem>
                {openIdeas.map(idea => (
                <MenuItem key={idea.id} value={idea.id}>
                  {idea.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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

          <FormControl fullWidth required error={!!error?.mcVersions} size="small">
            <InputLabel id="mc-versions-label">{tVersion("fields.mcVersions")}</InputLabel>
            <Select
              labelId="mc-versions-label"
              name="mcVersions"
              multiple
              value={mcVersions}
              onChange={(e) => setMcVersions(typeof e.target.value === "string" ? e.target.value.split(",") : e.target.value)}
              input={<OutlinedInput label={tVersion("fields.mcVersions")} />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip key={value} label={value} size="small" />
                  ))}
                </Box>
              )}
            >
              {MC_VERSIONS.map((v) => (
                <MenuItem key={v} value={v}>{v}</MenuItem>
              ))}
            </Select>
            {error?.mcVersions && <Typography color="error" variant="caption">{error.mcVersions[0]}</Typography>}
          </FormControl>

          <FormControl fullWidth required error={!!error?.loaders} size="small">
            <InputLabel id="loaders-label">{tVersion("fields.loaders")}</InputLabel>
            <Select
              labelId="loaders-label"
              name="loaders"
              multiple
              value={loaders}
              onChange={(e) => setLoaders(typeof e.target.value === "string" ? e.target.value.split(",") : e.target.value)}
              input={<OutlinedInput label={tVersion("fields.loaders")} />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => {
                    const info = getLoaderInfo(value);
                    return <Chip key={value} label={info.name} size="small" icon={info.icon} color={info.color} />;
                  })}
                </Box>
              )}
            >
              {AVAILABLE_LOADERS.map((l) => {
                const info = getLoaderInfo(l);
                return (
                  <MenuItem key={l} value={l}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {info.icon}
                      {info.name}
                    </Box>
                  </MenuItem>
                );
              })}
            </Select>
            {error?.loaders && <Typography color="error" variant="caption">{error.loaders[0]}</Typography>}
          </FormControl>

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
            <Button type="submit" variant="contained" disabled={pending || !file}>
              {pending ? <CircularProgress size={24} color="inherit" /> : tVersion("uploadForm.publish")}
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
