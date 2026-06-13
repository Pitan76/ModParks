"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import InputAdornment from "@mui/material/InputAdornment";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProject } from "@/lib/actions/project";

interface ProjectEditFormProps {
  project: {
    id: string;
    name: string;
    slug: string;
    type: string;
    description: string;
    license: string;
    sourceUrl?: string | null;
    status: string;
  };
}

export default function ProjectEditForm({ project }: ProjectEditFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ [key: string]: string[] } | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    
    // Server Action呼び出し
    const result = await updateProject(project.id, formData);
    
    if (result && result.error) {
      setError(result.error as { [key: string]: string[] });
      setPending(false);
    } else {
      router.push(`/projects/${formData.get("slug")}`);
    }
  };

  return (
    <Card>
      <CardContent sx={{ p: 4 }}>
        <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
            <TextField
              id="project-name"
              name="name"
              label="プロジェクト名"
              fullWidth
              required
              defaultValue={project.name}
              error={!!error?.name}
              helperText={error?.name?.[0]}
            />
            <TextField
              id="project-slug"
              name="slug"
              label="スラッグ"
              fullWidth
              required
              defaultValue={project.slug}
              error={!!error?.slug}
              helperText={error?.slug?.[0] || "半角英数字とハイフンのみ"}
              InputProps={{
                startAdornment: <InputAdornment position="start">https://modparks.net/projects/</InputAdornment>,
              }}
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
            <FormControl fullWidth required error={!!error?.type}>
              <InputLabel id="project-type-label">プロジェクトタイプ</InputLabel>
              <Select
                labelId="project-type-label"
                id="project-type"
                name="type"
                label="プロジェクトタイプ"
                defaultValue={project.type}
              >
                <MenuItem value="mod">Mod</MenuItem>
                <MenuItem value="plugin">Plugin</MenuItem>
              </Select>
              {error?.type && <Typography color="error" variant="caption">{error.type[0]}</Typography>}
            </FormControl>
            
            <FormControl fullWidth required>
              <InputLabel id="project-status-label">公開ステータス</InputLabel>
              <Select
                labelId="project-status-label"
                id="project-status"
                name="status"
                label="公開ステータス"
                defaultValue={project.status}
              >
                <MenuItem value="published">公開</MenuItem>
                <MenuItem value="draft">非公開 (下書き)</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          <TextField
            id="project-description"
            name="description"
            label="説明"
            multiline
            rows={5}
            fullWidth
            required
            defaultValue={project.description}
            error={!!error?.description}
            helperText={error?.description?.[0]}
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
            <TextField
              id="project-license"
              name="license"
              label="ライセンス"
              fullWidth
              required
              defaultValue={project.license}
              error={!!error?.license}
              helperText={error?.license?.[0]}
            />
            <TextField
              id="project-source"
              name="sourceUrl"
              label="ソースコードURL (任意)"
              fullWidth
              defaultValue={project.sourceUrl || ""}
              error={!!error?.sourceUrl}
              helperText={error?.sourceUrl?.[0]}
            />
          </Stack>

          <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end", gap: 2 }}>
            <Button variant="outlined" onClick={() => router.back()} disabled={pending}>
              キャンセル
            </Button>
            <Button type="submit" variant="contained" size="large" disabled={pending}>
              {pending ? "保存中..." : "変更を保存"}
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
