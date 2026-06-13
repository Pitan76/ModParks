import React from "react";
import TextField from "@mui/material/TextField";
import Stack from "@mui/material/Stack";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";

export interface ProjectFormFieldsProps {
  error: { [key: string]: string[] } | null;
  project?: {
    name?: string;
    slug?: string;
    type?: string;
    description?: string;
    license?: string;
    sourceUrl?: string | null;
  };
  children?: React.ReactNode;
}

export default function ProjectFormFields({ error, project, children }: ProjectFormFieldsProps) {
  const t = useTranslations("Project");

  return (
    <>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
        <TextField
          id="project-name"
          name="name"
          label={t("fields.name")}
          fullWidth
          required
          defaultValue={project?.name}
          error={!!error?.name}
          helperText={error?.name?.[0]}
        />
        <TextField
          id="project-slug"
          name="slug"
          label={t("fields.slug")}
          fullWidth
          required
          defaultValue={project?.slug}
          error={!!error?.slug}
          helperText={error?.slug?.[0] || t("fields.slugHelper")}
        />
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
        <FormControl fullWidth required error={!!error?.type}>
          <InputLabel id="project-type-label">{t("fields.type")}</InputLabel>
          <Select
            labelId="project-type-label"
            id="project-type"
            name="type"
            label={t("fields.type")}
            defaultValue={project?.type || "mod"}
          >
            <MenuItem value="mod">{t("type.mod")}</MenuItem>
            <MenuItem value="plugin">{t("type.plugin")}</MenuItem>
          </Select>
          {error?.type && <Typography color="error" variant="caption">{error.type[0]}</Typography>}
        </FormControl>
        {children}
      </Stack>

      <TextField
        id="project-description"
        name="description"
        label={t("fields.description")}
        multiline
        rows={5}
        fullWidth
        required
        defaultValue={project?.description}
        error={!!error?.description}
        helperText={error?.description?.[0]}
      />

      <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
        <TextField
          id="project-license"
          name="license"
          label={t("fields.license")}
          fullWidth
          required
          defaultValue={project?.license || "MIT"}
          error={!!error?.license}
          helperText={error?.license?.[0]}
        />
        <TextField
          id="project-source"
          name="sourceUrl"
          label={t("fields.sourceUrl")}
          fullWidth
          defaultValue={project?.sourceUrl || ""}
          error={!!error?.sourceUrl}
          helperText={error?.sourceUrl?.[0]}
        />
      </Stack>
    </>
  );
}
