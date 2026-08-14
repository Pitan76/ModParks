"use client";

import { useState } from "react";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import TranslateIcon from "@mui/icons-material/Translate";
import { useTranslations } from "next-intl";
import FormTextField from "@/components/ui/form/FormTextField";

export interface TranslationDraft {
  locale: string;
  title: string;
  body: string;
  state: "cached" | "manual" | null;
  stale: boolean;
}

interface TranslationAccordionProps {
  value: TranslationDraft;
  languageName: string;
  canDraft: boolean;
  busy: boolean;
  onChange: (next: TranslationDraft) => void;
  onDraft: () => void;
  onSave: () => void;
  onDelete: () => void;
}

/**
 * 1 言語ぶんの訳文エディタ。
 * 手動確定した訳は原文更新時も自動では訳し直さないため、古くなった場合は
 * その旨と「どうすれば訳し直せるか」を必ず併記する。
 */
export default function TranslationAccordion(props: TranslationAccordionProps) {
  const t = useTranslations("Project.translation");
  const [expanded, setExpanded] = useState(false);
  const { value } = props;

  return (
    <Accordion
      expanded={expanded}
      onChange={() => setExpanded(!expanded)}
      disableGutters
      sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, "&:before": { display: "none" } }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography>{props.languageName}</Typography>
          {value.state && <Chip size="small" label={t(`state.${value.state}`)} variant="outlined" />}
          {value.stale && <Chip size="small" color="warning" label={t("staleChip")} variant="outlined" />}
        </Box>
      </AccordionSummary>

      <AccordionDetails sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {value.stale && value.state === "manual" && (
          <Typography variant="body2" color="text.secondary">
            {t("manualStaleHelp")}
          </Typography>
        )}

        <FormTextField
          label={t("fields.title")}
          fullWidth
          value={value.title}
          onChange={(e) => props.onChange({ ...value, title: e.target.value })}
        />
        <FormTextField
          label={t("fields.body")}
          multiline
          minRows={8}
          fullWidth
          value={value.body}
          onChange={(e) => props.onChange({ ...value, body: e.target.value })}
          sx={{ "& textarea": { resize: "vertical !important" } }}
        />

        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {props.canDraft && (
            <Button variant="text" startIcon={<TranslateIcon />} onClick={props.onDraft} disabled={props.busy}>
              {t("draftButton")}
            </Button>
          )}
          <Box sx={{ flexGrow: 1 }} />
          {value.state && (
            <Button variant="text" color="error" onClick={props.onDelete} disabled={props.busy}>
              {t("deleteButton")}
            </Button>
          )}
          <Button variant="contained" onClick={props.onSave} disabled={props.busy}>
            {t("saveButton")}
          </Button>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}
