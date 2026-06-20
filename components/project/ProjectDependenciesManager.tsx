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
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Link from "@mui/material/Link";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { addProjectDependencyBySlug, addExternalProjectDependency, removeProjectDependency, DependencyType } from "@/lib/actions/dependency";
import { useRouter } from "@/i18n/routing";

import { useTranslations } from "next-intl";

export interface ProjectDependenciesManagerProps {
  projectId: string;
  dependencies: {
    id: string;
    dependencyType: DependencyType;
    project: { slug: string; name: string };
    externalUrl?: string | null;
    externalName?: string | null;
  }[];
}

export default function ProjectDependenciesManager({ projectId, dependencies }: ProjectDependenciesManagerProps) {
  const [tab, setTab] = useState(0);
  const [targetSlug, setTargetSlug] = useState("");
  const [extName, setExtName] = useState("");
  const [extUrl, setExtUrl] = useState("");
  const [depType, setDepType] = useState<DependencyType>("required");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; severity: "success" | "error" } | null>(null);
  const router = useRouter();
  const t = useTranslations("Project.dependencies");

  const handleAdd = async () => {
    setLoading(true);
    try {
      if (tab === 0) {
        if (!targetSlug) throw new Error("Target slug is required");
        await addProjectDependencyBySlug(projectId, targetSlug, depType);
      } else {
        if (!extName || !extUrl) throw new Error("Name and URL are required");
        await addExternalProjectDependency(projectId, extName, extUrl, depType);
      }
      setToast({ message: t("addSuccess"), severity: "success" });
      setTargetSlug("");
      setExtName("");
      setExtUrl("");
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
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2, width: "100%", overflow: "hidden" }}>
        <Tabs 
          value={tab} 
          onChange={(_, v) => setTab(v)} 
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ 
            maxWidth: { xs: 'calc(100vw - 32px)', sm: '100%' },
            '& .MuiTab-root': {
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }
          }}
        >
          <Tab label="ModParks Project" />
          <Tab label="External URL" />
        </Tabs>
      </Box>
      
      <Box sx={{ display: "flex", gap: 2, mb: 4, alignItems: "flex-end", flexWrap: "wrap" }}>
        {tab === 0 ? (
          <TextField
            label={t("targetSlug")}
            value={targetSlug}
            onChange={(e) => setTargetSlug(e.target.value)}
            size="small"
            sx={{ flex: "1 1 200px" }}
          />
        ) : (
          <>
            <TextField
              label="Name (e.g. Fabric API)"
              value={extName}
              onChange={(e) => setExtName(e.target.value)}
              size="small"
              sx={{ flex: "1 1 120px" }}
            />
            <TextField
              label="URL (e.g. https://modrinth.com/...)"
              value={extUrl}
              onChange={(e) => setExtUrl(e.target.value)}
              size="small"
              sx={{ flex: "2 1 200px" }}
            />
          </>
        )}
        <FormControl size="small" sx={{ flex: "1 1 120px" }}>
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
        <Button variant="contained" onClick={handleAdd} disabled={loading || (tab === 0 ? !targetSlug : (!extName || !extUrl))}>
          {t("add")}
        </Button>
      </Box>

      <Typography variant="h6" gutterBottom>{t("current")}</Typography>
      <List>
        {dependencies.map((dep) => (
          <ListItem key={dep.id} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, mb: 1 }}>
            <ListItemText 
              primary={dep.externalName ? (
                <Link href={dep.externalUrl!} target="_blank" rel="noopener noreferrer" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                  {dep.externalName} <OpenInNewIcon fontSize="small" />
                </Link>
              ) : dep.project.name} 
              secondary={`${t("type")}: ${t(dep.dependencyType)} | ${dep.externalUrl ? "External" : `Slug: ${dep.project.slug}`}`} 
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
