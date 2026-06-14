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
import { updateProject } from "@/lib/actions/project";
import ProjectFormFields from "@/components/project/ProjectFormFields";

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
  const t = useTranslations("Project.form");
  
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
          <ProjectFormFields error={error} project={project as any}>
            <FormControl fullWidth required>
              <InputLabel id="project-status-label">{t("status")}</InputLabel>
              <Select
                labelId="project-status-label"
                id="project-status"
                name="status"
                label={t("status")}
                defaultValue={project.status}
              >
                <MenuItem value="published">{t("published")}</MenuItem>
                <MenuItem value="draft">{t("draft")}</MenuItem>
              </Select>
            </FormControl>
          </ProjectFormFields>

          <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end", gap: 2 }}>
            <Button variant="outlined" onClick={() => router.back()} disabled={pending}>
              {t("cancel")}
            </Button>
            <Button type="submit" variant="contained" disabled={pending}>
              {pending ? t("saving") : t("save")}
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
