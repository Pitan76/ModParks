"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { useTranslations } from "next-intl";
import { DEPENDENCY_TYPES, MAX_DEPENDENCY_DRAFTS, type DependencyDraft, type DependencyType } from "@/lib/dependencies/types";
import { DEPENDENCY_COLOR } from "./VersionDependencies";

type Props = {
  value: DependencyDraft[];
  onChange: (drafts: DependencyDraft[]) => void;
  disabled?: boolean;
};

/**
 * 保存前の依存関係を組み立てるUI。バージョンのアップロードフォームで使う。
 *
 * バージョンがまだ存在しないため、ここでは一切保存せず配列を返すだけにして、
 * バージョン登録と同じ送信でまとめて書き込ませる。
 */
export default function DependencyDraftEditor({ value, onChange, disabled = false }: Props) {
  const t = useTranslations("Project.dependencies");
  const [mode, setMode] = useState<"internal" | "external">("internal");
  const [targetSlug, setTargetSlug] = useState("");
  const [extName, setExtName] = useState("");
  const [extUrl, setExtUrl] = useState("");
  const [depType, setDepType] = useState<DependencyType>("required");

  const canAdd = !disabled
    && value.length < MAX_DEPENDENCY_DRAFTS
    && (mode === "internal" ? !!targetSlug.trim() : !!extName.trim() && !!extUrl.trim());

  const handleAdd = () => {
    if (!canAdd) return;
    const draft: DependencyDraft = mode === "internal"
      ? { dependencyType: depType, targetSlug: targetSlug.trim() }
      : { dependencyType: depType, externalName: extName.trim(), externalUrl: extUrl.trim() };

    onChange([...value, draft]);
    setTargetSlug("");
    setExtName("");
    setExtUrl("");
  };

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 600 }}>
        {t("forVersion")}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
        {t("versionScopeHint")}
      </Typography>

      <Stack spacing={1.5} sx={{ mb: value.length > 0 ? 2 : 0 }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          color="primary"
          value={mode}
          onChange={(_, val) => val && setMode(val)}
          disabled={disabled}
        >
          <ToggleButton value="internal">ModParks</ToggleButton>
          <ToggleButton value="external">External URL</ToggleButton>
        </ToggleButtonGroup>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          {mode === "internal" ? (
            <TextField
              label={t("targetSlug")}
              value={targetSlug}
              onChange={(e) => setTargetSlug(e.target.value)}
              size="small"
              disabled={disabled}
              sx={{ flex: "1 1 auto" }}
            />
          ) : (
            <>
              <TextField
                label="Name"
                value={extName}
                onChange={(e) => setExtName(e.target.value)}
                size="small"
                disabled={disabled}
                sx={{ flex: "1 1 auto" }}
              />
              <TextField
                label="URL"
                value={extUrl}
                onChange={(e) => setExtUrl(e.target.value)}
                size="small"
                disabled={disabled}
                sx={{ flex: "2 1 auto" }}
              />
            </>
          )}
          <TextField
            select
            label={t("type")}
            value={depType}
            onChange={(e) => setDepType(e.target.value as DependencyType)}
            size="small"
            disabled={disabled}
            sx={{ minWidth: 140 }}
          >
            {DEPENDENCY_TYPES.map((type) => (
              <MenuItem key={type} value={type}>{t(type)}</MenuItem>
            ))}
          </TextField>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAdd} disabled={!canAdd} sx={{ whiteSpace: "nowrap" }}>
            {t("add")}
          </Button>
        </Stack>
      </Stack>

      {value.length > 0 && (
        <List dense disablePadding sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
          {value.map((draft, i) => (
            <ListItem
              key={`${draft.targetSlug || draft.externalUrl}-${i}`}
              divider={i !== value.length - 1}
              secondaryAction={
                <IconButton edge="end" size="small" color="error" onClick={() => handleRemove(i)} disabled={disabled}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              }
            >
              <ListItemText
                primary={draft.externalName || draft.targetSlug}
                secondary={draft.externalUrl}
                slotProps={{ secondary: { sx: { wordBreak: "break-all" } } }}
              />
              <Chip
                size="small"
                label={t(draft.dependencyType)}
                color={DEPENDENCY_COLOR[draft.dependencyType]}
                sx={{ height: 22, mr: 4 }}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}
