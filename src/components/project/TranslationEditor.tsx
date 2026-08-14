"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import { useTranslations } from "next-intl";
import TranslationAccordion, { type TranslationDraft } from "./TranslationAccordion";
import { useTranslationEditor } from "./useTranslationEditor";

interface TranslationEditorProps {
  projectId: string;
}

/**
 * 説明の多言語管理。初期状態では原文のエディタだけを見せ、作者が明示的に
 * 言語を足したときだけ入力欄を展開する。
 */
export default function TranslationEditor({ projectId }: TranslationEditorProps) {
  const t = useTranslations("Project.translation");
  const { state, load, update, add, save, remove, draft } = useTranslationEditor(projectId);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  useEffect(() => { void load(); }, [load]);

  const remaining = state.available.filter((l) => !state.drafts.some((d) => d.locale === l));
  const languageName = (locale: string) => t(`languages.${locale}`);

  return (
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>{t("sectionTitle")}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {state.canDraft ? t("sectionHelp") : t("sectionHelpNonPublic")}
      </Typography>

      <Stack spacing={1}>
        {state.drafts.map((d: TranslationDraft) => (
          <TranslationAccordion
            key={d.locale}
            value={d}
            languageName={languageName(d.locale)}
            canDraft={state.canDraft}
            busy={state.busy}
            onChange={(next) => update(next)}
            onDraft={() => void draft(d.locale)}
            onSave={() => void save(d.locale)}
            onDelete={() => void remove(d.locale)}
          />
        ))}
      </Stack>

      {state.error && (
        <Typography variant="body2" color="error" sx={{ mt: 2 }}>{t(`errors.${state.error}`)}</Typography>
      )}

      {remaining.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Button startIcon={<AddIcon />} onClick={(e) => setMenuAnchor(e.currentTarget)}>
            {t("addLanguage")}
          </Button>
          <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
            {remaining.map((locale) => (
              <MenuItem
                key={locale}
                onClick={() => { add(locale); setMenuAnchor(null); }}
              >
                {languageName(locale)}
              </MenuItem>
            ))}
          </Menu>
        </Box>
      )}
    </Box>
  );
}
