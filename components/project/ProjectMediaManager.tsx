"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import DeleteIcon from "@mui/icons-material/Delete";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import { useTranslations } from "next-intl";
import { uploadFileToR2 } from "@/lib/utils/upload";
import { addProjectMedia, deleteProjectMedia, toggleMediaFeatured } from "@/lib/actions/projectMedia";
import type { ProjectMedia } from "@/db/schema";

export type ProjectMediaManagerProps = {
  projectId: string;
  projectSlug: string;
  media: ProjectMedia[];
};

/** プロジェクトのスクリーンショット管理（アップロード・削除・カルーセル掲載切替） */
const ProjectMediaManager = ({ projectId, projectSlug, media }: ProjectMediaManagerProps) => {
  const t = useTranslations("Media");
  const [items, setItems] = useState<ProjectMedia[]>(media);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setBusy(true);
    setError(null);
    try {
      const { publicUrl } = await uploadFileToR2(file, { type: "media", projectSlug });
      const res = await addProjectMedia(projectId, publicUrl);
      if ("error" in res) {
        setError(t(`errors.${res.error}`));
      } else {
        // 反映のため簡易的にリロードせず楽観追加（順序はサーバー基準で次回取得時に整う）
        window.location.reload();
      }
    } catch {
      setError(t("errors.uploadFailed"));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(true);
    const res = await deleteProjectMedia(id);
    setBusy(false);
    if ("success" in res) setItems((prev) => prev.filter((m) => m.id !== id));
  };

  const handleToggle = async (id: string, featured: boolean) => {
    setItems((prev) => prev.map((m) => (m.id === id ? { ...m, featured } : m)));
    await toggleMediaFeatured(id, featured);
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {t("description")}
        </Typography>
        <Button component="label" variant="contained" startIcon={<AddPhotoAlternateIcon />} disabled={busy}>
          {t("upload")}
          <input type="file" accept="image/*" hidden onChange={handleUpload} />
        </Button>
      </Box>

      {error && (
        <Typography variant="caption" color="error" sx={{ display: "block", mb: 2 }}>
          {error}
        </Typography>
      )}

      {items.length === 0 ? (
        <Typography color="text.secondary">{t("empty")}</Typography>
      ) : (
        <Stack spacing={2}>
          {items.map((m) => (
            <Box
              key={m.id}
              sx={{ display: "flex", alignItems: "center", gap: 2, p: 1, border: "1px solid", borderColor: "divider", borderRadius: 1 }}
            >
              <Box
                component="img"
                src={m.url}
                alt={m.caption ?? ""}
                sx={{ width: 120, height: 68, objectFit: "cover", borderRadius: 1, flexShrink: 0 }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <FormControlLabel
                  control={<Switch checked={m.featured} onChange={(e) => handleToggle(m.id, e.target.checked)} size="small" />}
                  label={t("featured")}
                />
              </Box>
              <IconButton color="error" onClick={() => handleDelete(m.id)} disabled={busy} aria-label={t("delete")}>
                <DeleteIcon />
              </IconButton>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default ProjectMediaManager;
