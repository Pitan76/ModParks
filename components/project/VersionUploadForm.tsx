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

const MC_VERSIONS = ["1.21.5", "1.21.4", "1.21.1", "1.20.6", "1.20.4", "1.20.1", "1.19.4"];
const LOADERS = ["fabric", "forge", "neoforge", "quilt", "paper", "purpur", "velocity", "waterfall"];

/**
 * プロジェクトの新バージョン（ファイル）をアップロードするフォームコンポーネント。
 * R2への署名付きアップロードと、DBへのバージョン情報登録を行います。
 */
export interface VersionUploadFormProps {
  /** バージョンを追加する対象のプロジェクトSlug */
  slug: string;
}

export default function VersionUploadForm({ slug }: VersionUploadFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ [key: string]: string[] } | null>(null);
  
  const [mcVersions, setMcVersions] = useState<string[]>([]);
  const [loaders, setLoaders] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * フォーム送信処理。
   * 1. 署名付きURLの取得
   * 2. R2ストレージへのファイルアップロード
   * 3. DBへのバージョン登録 (Server Action)
   */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) {
      setError({ fileUrl: ["ファイルを選択してください"] });
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
        throw new Error("アップロードに失敗しました");
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
      setError({ fileUrl: [err.message || "アップロード中にエラーが発生しました"] });
      setPending(false);
    }
  };

  return (
    <Card>
      <CardContent sx={{ p: 4 }}>
        <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <TextField
            id="version-number"
            name="versionNumber"
            label="バージョン番号 (例: 1.0.0)"
            fullWidth
            required
            error={!!error?.versionNumber}
            helperText={error?.versionNumber?.[0]}
          />

          <FormControl fullWidth error={!!error?.mcVersions}>
            <InputLabel id="mc-versions-label">Minecraft バージョン</InputLabel>
            <Select
              labelId="mc-versions-label"
              id="mc-versions"
              multiple
              value={mcVersions}
              onChange={(e) => setMcVersions(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
              input={<OutlinedInput label="Minecraft バージョン" />}
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

          <FormControl fullWidth error={!!error?.loaders}>
            <InputLabel id="loaders-label">ローダー</InputLabel>
            <Select
              labelId="loaders-label"
              id="loaders"
              multiple
              value={loaders}
              onChange={(e) => setLoaders(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
              input={<OutlinedInput label="ローダー" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip key={value} label={value} size="small" />
                  ))}
                </Box>
              )}
            >
              {LOADERS.map((l) => (
                <MenuItem key={l} value={l}>{l}</MenuItem>
              ))}
            </Select>
            {error?.loaders && <Typography color="error" variant="caption">{error.loaders[0]}</Typography>}
          </FormControl>

          <TextField
            id="version-changelog"
            name="changelog"
            label="変更履歴 (Changelog)"
            multiline
            rows={4}
            fullWidth
            error={!!error?.changelog}
            helperText={error?.changelog?.[0]}
          />

          <Box sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 1, p: 3, textAlign: "center" }}>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              accept=".jar,.zip"
            />
            <Button variant="outlined" onClick={() => fileInputRef.current?.click()} disabled={pending}>
              ファイルを選択 (.jar, .zip)
            </Button>
            {file && (
              <Typography variant="body2" sx={{ mt: 2 }}>
                選択中: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </Typography>
            )}
            {error?.fileUrl && <Typography color="error" variant="caption" display="block" sx={{ mt: 1 }}>{error.fileUrl[0]}</Typography>}
          </Box>

          <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end", gap: 2 }}>
            <Button variant="outlined" onClick={() => router.back()} disabled={pending}>
              キャンセル
            </Button>
            <Button type="submit" variant="contained" size="large" disabled={pending || mcVersions.length === 0 || loaders.length === 0 || !file}>
              {pending ? <CircularProgress size={24} color="inherit" /> : "バージョンを公開"}
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
