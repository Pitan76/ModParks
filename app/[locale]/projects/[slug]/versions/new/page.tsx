"use client";

import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import OutlinedInput from "@mui/material/OutlinedInput";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { createVersion } from "@/lib/actions/version";

interface NewVersionPageProps {
  params: Promise<{ slug: string }>;
}

const MC_VERSIONS = ["1.21.5", "1.21.4", "1.21.1", "1.20.6", "1.20.4", "1.20.1", "1.19.4"];
const LOADERS = ["fabric", "forge", "neoforge", "quilt", "paper", "purpur", "velocity", "waterfall"];

export default function NewVersionPage({ params }: NewVersionPageProps) {
  const router = useRouter();
  const { slug } = use(params);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ [key: string]: string[] } | null>(null);
  
  const [mcVersions, setMcVersions] = useState<string[]>([]);
  const [loaders, setLoaders] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    mcVersions.forEach(v => formData.append("mcVersions", v));
    loaders.forEach(l => formData.append("loaders", l));
    
    // ダミーのファイル情報を付与（本来はここでR2にアップロードしてURLを取得する）
    formData.append("fileUrl", "https://example.com/dummy.jar");
    formData.append("fileName", "dummy.jar");
    formData.append("fileSize", "1024000");

    // Server Action呼び出し
    const result = await createVersion(slug, formData);
    
    if (result && result.error) {
      setError(result.error as { [key: string]: string[] });
      setPending(false);
    } else {
      router.push(`/projects/${slug}`);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Typography variant="h4" fontWeight={800} sx={{ mb: 4 }}>
        新バージョンをアップロード
      </Typography>

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

            <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end", gap: 2 }}>
              <Button variant="outlined" onClick={() => router.back()} disabled={pending}>
                キャンセル
              </Button>
              <Button type="submit" variant="contained" size="large" disabled={pending || mcVersions.length === 0 || loaders.length === 0}>
                {pending ? "アップロード中..." : "バージョンを公開"}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}
