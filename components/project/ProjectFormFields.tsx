import React from "react";
import TextField from "@mui/material/TextField";
import Stack from "@mui/material/Stack";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import Autocomplete from "@mui/material/Autocomplete";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import { useState } from "react";
import { useTranslations } from "next-intl";
import ProjectIconUpload from "./ProjectIconUpload";



export interface ProjectFormFieldsProps {
  error: { [key: string]: string[] } | null;
  project?: {
    name?: string;
    slug?: string;
    type?: string;
    description?: string;
    license?: string;
    sourceUrl?: string | null;
    links?: string | null;
    iconUrl?: string | null;
    modrinthId?: string | null;
    curseforgeId?: string | null;
    tags?: string[];
  };
  availableTags?: { slug: string; name: string }[];
  defaultLicense?: string;
  children?: React.ReactNode;
}

export default function ProjectFormFields({ error, project, availableTags = [], defaultLicense, children }: ProjectFormFieldsProps) {
  const t = useTranslations("Project");
  const tTags = useTranslations("Tags");
  const [tags, setTags] = useState<string[]>(project?.tags || []);
  
  let initialLinks = [];
  try {
    initialLinks = JSON.parse(project?.links || "[]");
    if (!Array.isArray(initialLinks)) initialLinks = [];
  } catch(e) {}
  const [links, setLinks] = useState<{ title: string, url: string }[]>(initialLinks);

  const handleAddLink = () => setLinks([...links, { title: "", url: "" }]);
  const handleRemoveLink = (idx: number) => setLinks(links.filter((_, i) => i !== idx));
  const handleLinkChange = (idx: number, field: "title" | "url", val: string) => {
    const newLinks = [...links];
    newLinks[idx][field] = val;
    setLinks(newLinks);
  };

  return (
    <>
      <ProjectIconUpload initialIconUrl={project?.iconUrl} projectSlug={project?.slug} />

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
        minRows={10}
        fullWidth
        required
        defaultValue={project?.description}
        error={!!error?.description}
        helperText={error?.description?.[0]}
        sx={{
          "& textarea": {
            resize: "vertical !important",
          }
        }}
      />

      <Autocomplete
        multiple
        freeSolo
        disableCloseOnSelect
        options={availableTags}
        getOptionLabel={(option) => {
          const slug = typeof option === "string" ? option : option.slug;
          try {
            const translated = tTags(slug as any);
            if (translated && !translated.includes(".")) return translated;
          } catch {}
          if (typeof option === "string") return option;
          return option.name || option.slug || "";
        }}
        value={tags}
        onChange={(_, newValue) => {
          const stringValues = newValue.map((v: any) => {
            if (typeof v === "string") return v;
            return v.slug || v.inputValue || "";
          });
          setTags(stringValues.filter(Boolean));
        }}
        // @ts-ignore
        renderTags={(tagValue: readonly any[], getTagProps: any) =>
          tagValue.map((option, index) => {
            const optionSlug = typeof option === "string" ? option : (option.slug || option.inputValue);
            const foundObj = availableTags.find((tObj) => tObj.slug === optionSlug);
            let label = foundObj ? foundObj.name : optionSlug;
            try { 
              const translated = tTags(optionSlug as any);
              if (translated && !translated.includes(".")) label = translated;
            } catch {}
            return <Chip variant="outlined" label={label} {...getTagProps({ index })} key={`tag-${index}`} />;
          })
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label={t("fields.tags")}
            placeholder={t("fields.tags")}
            error={!!error?.tags}
            helperText={error?.tags?.[0]}
          />
        )}
      />
      {tags.map((tag) => (
        <input type="hidden" name="tags" value={tag} key={`hidden-tag-${tag}`} />
      ))}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
        <Autocomplete
          id="project-license"
          freeSolo
          options={["MIT", "Apache-2.0", "GPL-3.0", "LGPL-3.0", "All Rights Reserved", "CC0-1.0", "CC-BY-4.0", "CC-BY-SA-4.0"]}
          defaultValue={project?.license || defaultLicense || "MIT"}
          fullWidth
          renderInput={(params) => (
            <TextField
              {...params}
              name="license"
              label={t("fields.license")}
              required
              error={!!error?.license}
              helperText={error?.license?.[0]}
            />
          )}
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

      <Typography variant="subtitle1" sx={{ mt: 2, fontWeight: 600 }}>{t("fields.externalConnectionsTitle")}</Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
        <TextField
          id="project-modrinth"
          name="modrinthId"
          label={t("fields.modrinthId")}
          fullWidth
          defaultValue={project?.modrinthId || ""}
          error={!!error?.modrinthId}
          helperText={error?.modrinthId?.[0]}
        />
        <TextField
          id="project-curseforge"
          name="curseforgeId"
          label={t("fields.curseforgeId")}
          fullWidth
          defaultValue={project?.curseforgeId || ""}
          error={!!error?.curseforgeId}
          helperText={error?.curseforgeId?.[0]}
        />
      </Stack>

      <Typography variant="subtitle1" sx={{ mt: 2, fontWeight: 600 }}>{t("fields.customLinks.title")}</Typography>
      {links.map((link, idx) => (
        <Stack direction="row" spacing={2} key={idx} sx={{ alignItems: "center" }}>
          <TextField
            label={t("fields.customLinks.linkTitle")}
            size="small"
            value={link.title}
            onChange={e => handleLinkChange(idx, "title", e.target.value)}
            sx={{ width: 150 }}
          />
          <TextField
            label={t("fields.customLinks.url")}
            size="small"
            value={link.url}
            onChange={e => handleLinkChange(idx, "url", e.target.value)}
            sx={{ flex: 1 }}
          />
          <Chip label={t("fields.customLinks.delete")} color="error" variant="outlined" onClick={() => handleRemoveLink(idx)} sx={{ cursor: "pointer" }} />
        </Stack>
      ))}
      <Box>
        <Chip label={t("fields.customLinks.addLink")} color="primary" variant="outlined" onClick={handleAddLink} sx={{ cursor: "pointer" }} />
      </Box>
      <input type="hidden" name="links" value={JSON.stringify(links)} />
    </>
  );
}
