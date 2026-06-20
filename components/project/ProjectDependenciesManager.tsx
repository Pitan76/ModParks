"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemSecondaryAction from "@mui/material/ListItemSecondaryAction";
import IconButton from "@mui/material/IconButton";
import DeleteIcon from "@mui/icons-material/Delete";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import { addProjectDependencyBySlug, removeProjectDependency, DependencyType } from "@/lib/actions/dependency";
import { useRouter } from "@/i18n/routing";

export interface ProjectDependenciesManagerProps {
  projectId: string;
  dependencies: {
    id: string;
    dependencyType: DependencyType;
    project: { slug: string; name: string };
  }[];
}

export default function ProjectDependenciesManager({ projectId, dependencies }: ProjectDependenciesManagerProps) {
  const [targetSlug, setTargetSlug] = useState("");
  const [depType, setDepType] = useState<DependencyType>("required");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; severity: "success" | "error" } | null>(null);
  const router = useRouter();

  const handleAdd = async () => {
    if (!targetSlug) return;
    setLoading(true);
    try {
      const res = await addProjectDependencyBySlug(projectId, targetSlug, depType);
      if (res.error) {
        setToast({ message: "追加に失敗しました", severity: "error" });
      } else {
        setToast({ message: "依存関係を追加しました", severity: "success" });
        setTargetSlug("");
        router.refresh();
      }
    } catch (e: any) {
      setToast({ message: e.message || "追加に失敗しました", severity: "error" });
    }
    setLoading(false);
  };

  const handleRemove = async (depId: string) => {
    setLoading(true);
    try {
      await removeProjectDependency(depId);
      enqueueSnackbar("依存関係を削除しました", { variant: "success" });
      router.refresh();
    } catch (e: any) {
      enqueueSnackbar(e.message, { variant: "error" });
    }
    setLoading(false);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>依存関係の追加</Typography>
      <Box sx={{ display: "flex", gap: 2, mb: 4, alignItems: "center" }}>
        <TextField
          label="対象プロジェクトのスラッグ (例: mod-abc)"
          value={targetSlug}
          onChange={(e) => setTargetSlug(e.target.value)}
          size="small"
          fullWidth
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>タイプ</InputLabel>
          <Select
            value={depType}
            label="タイプ"
            onChange={(e) => setDepType(e.target.value as DependencyType)}
          >
            <MenuItem value="required">Required (必須)</MenuItem>
            <MenuItem value="optional">Optional (任意)</MenuItem>
            <MenuItem value="incompatible">Incompatible (競合)</MenuItem>
            <MenuItem value="embedded">Embedded (同梱)</MenuItem>
          </Select>
        </FormControl>
        <Button variant="contained" onClick={handleAdd} disabled={loading || !targetSlug}>
          追加
        </Button>
      </Box>

      <Typography variant="h6" gutterBottom>現在の依存関係</Typography>
      <List>
        {dependencies.map((dep) => (
          <ListItem key={dep.id} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, mb: 1 }}>
            <ListItemText 
              primary={dep.project.name} 
              secondary={`Type: ${dep.dependencyType} | Slug: ${dep.project.slug}`} 
            />
            <ListItemSecondaryAction>
              <IconButton edge="end" onClick={() => handleRemove(dep.id)} disabled={loading}>
                <DeleteIcon />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
        {dependencies.length === 0 && (
          <Typography color="text.secondary">依存関係はありません。</Typography>
        )}
      </List>
    </Box>
  );
}
