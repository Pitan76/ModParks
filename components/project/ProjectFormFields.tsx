import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import FormTextField from "@/components/ui/form/FormTextField";
import FormSelect from "@/components/ui/form/FormSelect";
import FormAutocomplete from "@/components/ui/form/FormAutocomplete";
import { useState } from "react";
import { useTranslations } from "next-intl";
import ProjectIconUpload from "./ProjectIconUpload";
import { LICENSE_OPTIONS } from "@/lib/licenses";
import { useLinksEditor } from "@/lib/hooks/useLinksEditor";



export interface ProjectFormFieldsProps {
  error: { [key: string]: string[] } | null;
  project?: {
    name?: string;
    slug?: string;
    type?: string;
    description?: string;
    descriptionFormat?: string;
    license?: string;
    sourceUrl?: string | null;
    links?: string | null;
    iconUrl?: string | null;
    modrinthId?: string | null;
    curseforgeId?: string | null;
    githubRepo?: string | null;
    tags?: string[];
  };
  availableTags?: { slug: string; name: string }[];
  defaultLicense?: string;
  children?: React.ReactNode;
}

export default function ProjectFormFields({ error, project, availableTags = [], defaultLicense, children }: ProjectFormFieldsProps) {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Project");
  const tTags = useTranslations("Tags");
  const [tags, setTags] = useState<string[]>(project?.tags || []);
  
  const { links, addLink, removeLink, changeLink } = useLinksEditor(project?.links);

  return (
    <>
      <ProjectIconUpload initialIconUrl={project?.iconUrl} projectSlug={project?.slug} />

      <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
        <FormTextField
          id="project-name"
          name="name"
          label={t("fields.name")}
          fullWidth
          required
          defaultValue={project?.name}
          errorMessages={error?.name}
        />
        <FormTextField
          id="project-slug"
          name="slug"
          label={t("fields.slug")}
          fullWidth
          required
          defaultValue={project?.slug}
          errorMessages={error?.slug}
          helperText={t("fields.slugHelper")}
        />
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
        <FormSelect
          id="project-type"
          name="type"
          label={t("fields.type")}
          defaultValue={project?.type || "mod"}
          errorMessages={error?.type}
          options={[
            { value: "mod", label: t("type.mod") },
            { value: "plugin", label: t("type.plugin") },
            { value: "resourcepack", label: t("type.resourcepack") },
            { value: "datapack", label: t("type.datapack") },
            { value: "shader", label: t("type.shader") },
            { value: "modpack", label: t("type.modpack") },
          ]}
          formControlProps={{ required: true }}
        />
        {children}
      </Stack>

      <Stack direction="column" spacing={1}>
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <FormSelect
            id="project-description-format"
            name="descriptionFormat"
            size="small"
            label={t("fields.descriptionFormat")}
            defaultValue={project?.descriptionFormat || "markdown"}
            options={[
              { value: "markdown", label: "Markdown" },
              { value: "plaintext", label: "Plain Text" },
              { value: "pukiwiki", label: "PukiWiki" },
            ]}
            formControlProps={{ sx: { minWidth: 150 } }}
          />
        </Box>
        <FormTextField
          id="project-description"
          name="description"
          label={t("fields.description")}
          multiline
          minRows={10}
          fullWidth
          required
          defaultValue={project?.description}
          errorMessages={error?.description}
          sx={{
            "& textarea": {
              resize: "vertical !important",
            }
          }}
        />
      </Stack>

      <FormAutocomplete
        multiple
        freeSolo
        disableCloseOnSelect
        // @ts-ignore
        options={availableTags}
        getOptionLabel={(option: any) => {
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
        label={t("fields.tags")}
        placeholder={t("fields.tags")}
        errorMessages={error?.tags}
      />
      {tags.map((tag) => (
        <input type="hidden" name="tags" value={tag} key={`hidden-tag-${tag}`} />
      ))}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
        <FormAutocomplete
          id="project-license"
          freeSolo
          options={LICENSE_OPTIONS as unknown as string[]}
          defaultValue={project?.license || defaultLicense || "MIT"}
          fullWidth
          label={t("fields.license")}
          errorMessages={error?.license}
          renderInputProps={{ name: "license", required: true }}
        />
        <FormTextField
          id="project-source"
          name="sourceUrl"
          label={t("fields.sourceUrl")}
          fullWidth
          defaultValue={project?.sourceUrl || ""}
          errorMessages={error?.sourceUrl}
        />
        <FormTextField
          id="project-issue-tracker"
          name="issueTrackerUrl"
          label={t("fields.issueTrackerUrl")}
          fullWidth
          defaultValue={(project as any)?.issueTrackerUrl || ""}
          errorMessages={error?.issueTrackerUrl}
        />
      </Stack>

      <Typography variant="subtitle1" sx={{ mt: 2, fontWeight: 600 }}>{t("fields.externalConnectionsTitle")}</Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
        <FormTextField
          id="project-modrinth"
          name="modrinthId"
          label={t("fields.modrinthId")}
          fullWidth
          defaultValue={project?.modrinthId || ""}
          errorMessages={error?.modrinthId}
        />
        <FormTextField
          id="project-curseforge"
          name="curseforgeId"
          label={t("fields.curseforgeId")}
          fullWidth
          defaultValue={project?.curseforgeId || ""}
          errorMessages={error?.curseforgeId}
        />
      </Stack>
      <FormTextField
        id="project-github-repo"
        name="githubRepo"
        label={t("fields.githubRepo")}
        placeholder="owner/repo"
        fullWidth
        defaultValue={project?.githubRepo || ""}
        errorMessages={error?.githubRepo}
        helperText={t("fields.githubRepoHelper")}
      />

      <Typography variant="subtitle1" sx={{ mt: 2, fontWeight: 600 }}>{t("fields.customLinks.title")}</Typography>
      {links.map((link, idx) => (
        <Stack direction="row" spacing={2} key={idx} sx={{ alignItems: "center" }}>
          <FormTextField
            label={t("fields.customLinks.linkTitle")}
            size="small"
            value={link.title}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => changeLink(idx, "title", e.target.value)}
            sx={{ width: 150 }}
          />
          <FormTextField
            label={t("fields.customLinks.url")}
            size="small"
            value={link.url}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => changeLink(idx, "url", e.target.value)}
            sx={{ flex: 1 }}
          />
          <Chip label={tCommon("delete")} color="error" variant="outlined" onClick={() => removeLink(idx)} sx={{ cursor: "pointer" }} />
        </Stack>
      ))}
      <Box>
        <Chip label={t("fields.customLinks.addLink")} color="primary" variant="outlined" onClick={addLink} sx={{ cursor: "pointer" }} />
      </Box>
      <input type="hidden" name="links" value={JSON.stringify(links)} />
    </>
  );
}
