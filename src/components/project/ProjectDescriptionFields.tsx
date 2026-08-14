"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import { useTranslations } from "next-intl";
import FormSelect from "@/components/ui/form/FormSelect";
import FormTextField from "@/components/ui/form/FormTextField";
import { locales } from "@/lib/i18n/locales";

export interface ProjectDescriptionFieldsProps {
  description?: string;
  descriptionFormat?: string;
  /** 原文の言語。編集画面でのみ変更でき、多言語表示の起点になる */
  sourceLocale?: string;
  defaultBodyFormat?: string;
  errorMessages?: string[];
  /** 原文の言語を選ばせるか。新規作成では作成時のロケールを使うので出さない */
  withSourceLocale?: boolean;
  onChange?: () => void;
}

/**
 * 原文の説明（言語・書式・本文）の入力欄。
 * 訳文側の入力は TranslationEditor が持つ。
 */
const ProjectDescriptionFields = ({
  description,
  descriptionFormat,
  sourceLocale,
  defaultBodyFormat,
  errorMessages,
  withSourceLocale = false,
  onChange,
}: ProjectDescriptionFieldsProps) => {
  const t = useTranslations("Project");
  const tLang = useTranslations("Project.translation.languages");

  return (
    <Stack direction="column" spacing={1}>
      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
        {withSourceLocale && (
          <FormSelect
            id="project-source-locale"
            name="sourceLocale"
            size="small"
            label={t("fields.sourceLocale")}
            defaultValue={sourceLocale || locales[0]}
            options={locales.map((locale) => ({ value: locale, label: tLang(locale) }))}
            formControlProps={{ sx: { minWidth: 150 } }}
            onChange={onChange}
          />
        )}
        <FormSelect
          id="project-description-format"
          name="descriptionFormat"
          size="small"
          label={t("fields.descriptionFormat")}
          defaultValue={descriptionFormat || defaultBodyFormat || "markdown"}
          options={[
            { value: "markdown", label: "Markdown" },
            { value: "plaintext", label: "Plain Text" },
            { value: "pukiwiki", label: "PukiWiki" },
          ]}
          formControlProps={{ sx: { minWidth: 150 } }}
          onChange={onChange}
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
        defaultValue={description}
        errorMessages={errorMessages}
        sx={{ "& textarea": { resize: "vertical !important" } }}
      />
    </Stack>
  );
};

export default ProjectDescriptionFields;
