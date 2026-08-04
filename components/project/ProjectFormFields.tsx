"use client";

import type { ChangeEvent, ReactNode } from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import FormTextField from "@/components/ui/form/FormTextField";
import FormSelect from "@/components/ui/form/FormSelect";
import FormAutocomplete from "@/components/ui/form/FormAutocomplete";
import TagAutocomplete from "./TagAutocomplete";
import { useState } from "react";
import { useTranslations } from "next-intl";
import ProjectIconUpload from "./ProjectIconUpload";
import { LICENSE_OPTIONS } from "@/lib/licenses";
import { useLinksEditor } from "@/lib/hooks/useLinksEditor";

type OptionItem = {
  slug: string;
  name: string;
  inputValue?: string;
};

export type ProjectFormFieldsProps = {
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
    discordWebhookUrl?: string | null;
    tags?: string[];
    issueTrackerUrl?: string | null;
  };
  availableTags?: OptionItem[];
  defaultLicense?: string;
  defaultBodyFormat?: string;
  children?: ReactNode;
};

/**
 * 新規作成や編集ページにおいて、プロジェクトの基本情報（名称、説明、タグ、ライセンス、リンク等）を編集するフォームフィールド群コンポーネント。
 */
const ProjectFormFields = ({ error, project, availableTags = [], defaultLicense, defaultBodyFormat, children }: ProjectFormFieldsProps) => {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Project");
  const [tags, setTags] = useState<string[]>(project?.tags || []);
  
  const { links, addLink, removeLink, changeLink, moveLink } = useLinksEditor(project?.links);

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
            defaultValue={project?.descriptionFormat || defaultBodyFormat || "markdown"}
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

      <TagAutocomplete
        availableTags={availableTags}
        tags={tags}
        onChange={setTags}
        label={t("fields.tags")}
        placeholder={t("fields.tags")}
        error={!!error?.tags}
        helperText={error?.tags?.[0]}
        required={false}
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
          defaultValue={project?.issueTrackerUrl || ""}
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
      <FormTextField
        id="project-discord-webhook"
        name="discordWebhookUrl"
        label={t("fields.discordWebhook")}
        placeholder="https://discord.com/api/webhooks/..."
        fullWidth
        defaultValue={project?.discordWebhookUrl || ""}
        errorMessages={error?.discordWebhookUrl}
        helperText={t("fields.discordWebhookHelper")}
      />

      <Typography variant="subtitle1" sx={{ mt: 2, fontWeight: 600 }}>{t("fields.customLinks.title")}</Typography>
      {links.map((link, idx) => (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          key={idx}
          sx={{ alignItems: { xs: "stretch", sm: "center" } }}
        >
          <FormTextField
            label={t("fields.customLinks.linkTitle")}
            size="small"
            value={link.title}
            onChange={(e: ChangeEvent<HTMLInputElement>) => changeLink(idx, "title", e.target.value)}
            sx={{ width: { xs: "100%", sm: 150 } }}
          />
          <FormTextField
            label={t("fields.customLinks.url")}
            size="small"
            value={link.url}
            onChange={(e: ChangeEvent<HTMLInputElement>) => changeLink(idx, "url", e.target.value)}
            sx={{ flex: 1 }}
          />
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", justifyContent: "flex-end", alignSelf: { xs: "flex-end", sm: "center" }, flexShrink: 0 }}>
            <IconButton size="small" aria-label={t("fields.customLinks.moveUp")} disabled={idx === 0} onClick={() => moveLink(idx, -1)}>
              <ArrowUpwardIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" aria-label={t("fields.customLinks.moveDown")} disabled={idx === links.length - 1} onClick={() => moveLink(idx, 1)}>
              <ArrowDownwardIcon fontSize="small" />
            </IconButton>
            <Chip label={tCommon("delete")} color="error" variant="outlined" onClick={() => removeLink(idx)} sx={{ cursor: "pointer" }} />
          </Box>
        </Stack>
      ))}
      <Box>
        <Chip label={t("fields.customLinks.addLink")} color="primary" variant="outlined" onClick={addLink} sx={{ cursor: "pointer" }} />
      </Box>
      <input type="hidden" name="links" value={JSON.stringify(links)} />
    </>
  );
};

export default ProjectFormFields;
