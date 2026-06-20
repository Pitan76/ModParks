"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { updateProject, syncExternalProjectData } from "@/lib/actions/project";
import ProjectFormFields from "@/components/project/ProjectFormFields";
import SyncIcon from "@mui/icons-material/Sync";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

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
  availableTags?: { slug: string; name: string }[];
}

export default function ProjectEditForm({ project, availableTags = [] }: ProjectEditFormProps) {
  const router = useRouter();
  const t = useTranslations("Project.form");
  const tManage = useTranslations("Project.managePage");
  
  const [pending, setPending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ message: string; severity: "success" | "error" } | null>(null);
  const [error, setError] = useState<{ [key: string]: string[] } | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncExternalProjectData(project.id);
      setToast({ message: tManage("syncSuccess"), severity: "success" });
    } catch (e: any) {
      if (e.message?.includes("CF_API_KEY_MISSING")) {
        setToast({ message: t("apiKeyMissing"), severity: "error" });
      } else {
        setToast({ message: tManage("syncError"), severity: "error" });
      }
    } finally {
      setSyncing(false);
    }
  };

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
          <ProjectFormFields error={error} project={project as any} availableTags={availableTags}>
            <FormControl fullWidth required>
              <InputLabel id="project-status-label">{t("status")}</InputLabel>
              <Select
                labelId="project-status-label"
                id="project-status"
                name="status"
                label={t("status")}
                defaultValue={project.status}
              >
                <MenuItem value="public">{t("public")}</MenuItem>
                <MenuItem value="unlisted">{t("unlisted")}</MenuItem>
                <MenuItem value="private">{t("private")}</MenuItem>
                <MenuItem value="draft">{t("draft")}</MenuItem>
              </Select>
            </FormControl>
          </ProjectFormFields>

          <Box sx={{ mt: 2, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2 }}>
            <Button 
              variant="text" 
              color="primary" 
              startIcon={<SyncIcon />} 
              onClick={handleSync} 
              disabled={syncing || pending}
            >
              {syncing ? tManage("syncing") : tManage("sync")}
            </Button>

            <Box sx={{ display: "flex", gap: 2 }}>
              <Button variant="outlined" onClick={() => router.back()} disabled={pending}>
                {t("cancel")}
              </Button>
              <Button type="submit" variant="contained" disabled={pending}>
                {pending ? t("saving") : t("save")}
              </Button>
            </Box>
          </Box>
        </Box>
      </CardContent>

      <Snackbar open={!!toast} autoHideDuration={6000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setToast(null)} severity={toast?.severity} sx={{ width: '100%' }}>
          {toast?.message}
        </Alert>
      </Snackbar>
    </Card>
  );
}
