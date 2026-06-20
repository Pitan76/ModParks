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
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import { addProjectDependencyBySlug, removeProjectDependency, DependencyType } from "@/lib/actions/dependency";
import { useRouter } from "@/i18n/routing";

import { useTranslations } from "next-intl";

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
  const t = useTranslations("Project.dependencies");

  const handleAdd = async () => {
    if (!targetSlug) return;
    setLoading(true);
    try {
      await addProjectDependencyBySlug(projectId, targetSlug, depType);
      setToast({ message: t("addSuccess"), severity: "success" });
      setTargetSlug("");
      router.refresh();
    } catch (e: any) {
      setToast({ message: e.message || t("addError"), severity: "error" });
    }
    setLoading(false);
  };

  const handleRemove = async (depId: string) => {
    setLoading(true);
    try {
      await removeProjectDependency(depId);
      setToast({ message: t("removeSuccess"), severity: "success" });
      router.refresh();
    } catch (e: any) {
      setToast({ message: e.message, severity: "error" });
    }
    setLoading(false);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>{t("add")}</Typography>
      <Box sx={{ display: "flex", gap: 2, mb: 4, alignItems: "center" }}>
        <TextField
          label={t("targetSlug")}
          value={targetSlug}
          onChange={(e) => setTargetSlug(e.target.value)}
          size="small"
          fullWidth
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>{t("type")}</InputLabel>
          <Select
            value={depType}
            label={t("type")}
            onChange={(e) => setDepType(e.target.value as DependencyType)}
          >
            <MenuItem value="required">{t("required")}</MenuItem>
            <MenuItem value="optional">{t("optional")}</MenuItem>
            <MenuItem value="incompatible">{t("incompatible")}</MenuItem>
            <MenuItem value="embedded">{t("embedded")}</MenuItem>
          </Select>
        </FormControl>
        <Button variant="contained" onClick={handleAdd} disabled={loading || !targetSlug}>
          {t("add")}
        </Button>
      </Box>

      <Typography variant="h6" gutterBottom>{t("current")}</Typography>
      <List>
        {dependencies.map((dep) => (
          <ListItem key={dep.id} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, mb: 1 }}>
            <ListItemText 
              primary={dep.project.name} 
              secondary={`${t("type")}: ${t(dep.dependencyType)} | Slug: ${dep.project.slug}`} 
            />
            <ListItemSecondaryAction>
              <IconButton edge="end" onClick={() => handleRemove(dep.id)} disabled={loading}>
                <DeleteIcon />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
        {dependencies.length === 0 && (
          <Typography color="text.secondary">{t("noDependencies")}</Typography>
        )}
      </List>
      <Snackbar open={!!toast} autoHideDuration={6000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setToast(null)} severity={toast?.severity || "info"} sx={{ width: '100%' }}>
          {toast?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
