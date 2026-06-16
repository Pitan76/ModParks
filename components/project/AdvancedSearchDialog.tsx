"use client";

import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import { useTranslations } from "next-intl";
import { LOADERS, MC_VERSIONS, PREDEFINED_TAGS } from "@/lib/validations";
import { getLoaderInfo } from "@/lib/loaders";
import { useState, useEffect } from "react";

export interface AdvancedSearchFilters {
  loaders: string[];
  mcVersions: string[];
  tags: string[];
  searchMode: string;
  includeDesc: boolean;
  includeTags: boolean;
  includeAuthor: boolean;
}

interface AdvancedSearchDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: (filters: AdvancedSearchFilters) => void;
  initialFilters: AdvancedSearchFilters;
}

export default function AdvancedSearchDialog({ open, onClose, onApply, initialFilters }: AdvancedSearchDialogProps) {
  const t = useTranslations("Search");
  const tCommon = useTranslations("Common");
  const tTags = useTranslations("Tags");

  const [tempLoaders, setTempLoaders] = useState<string[]>(initialFilters.loaders);
  const [tempMcVersions, setTempMcVersions] = useState<string[]>(initialFilters.mcVersions);
  const [tempTags, setTempTags] = useState<string[]>(initialFilters.tags);
  const [tempSearchMode, setTempSearchMode] = useState(initialFilters.searchMode);
  const [tempIncludeDesc, setTempIncludeDesc] = useState(initialFilters.includeDesc);
  const [tempIncludeTags, setTempIncludeTags] = useState(initialFilters.includeTags);
  const [tempIncludeAuthor, setTempIncludeAuthor] = useState(initialFilters.includeAuthor);

  // Sync local state when dialog opens
  useEffect(() => {
    if (open) {
      setTempLoaders(initialFilters.loaders);
      setTempMcVersions(initialFilters.mcVersions);
      setTempTags(initialFilters.tags);
      setTempSearchMode(initialFilters.searchMode);
      setTempIncludeDesc(initialFilters.includeDesc);
      setTempIncludeTags(initialFilters.includeTags);
      setTempIncludeAuthor(initialFilters.includeAuthor);
    }
  }, [open, initialFilters]);

  const handleApply = () => {
    onApply({
      loaders: tempLoaders,
      mcVersions: tempMcVersions,
      tags: tempTags,
      searchMode: tempSearchMode,
      includeDesc: tempIncludeDesc,
      includeTags: tempIncludeTags,
      includeAuthor: tempIncludeAuthor,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t("advancedSearch")}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 3, pt: 2 }}>
        
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Typography variant="subtitle2" color="text.secondary">{t("keywordOptions")}</Typography>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <ToggleButtonGroup
              value={tempSearchMode}
              exclusive
              onChange={(_, v) => { if (v) setTempSearchMode(v); }}
              size="small"
            >
              <ToggleButton value="OR">OR</ToggleButton>
              <ToggleButton value="AND">AND</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mt: 1 }}>
            <FormControlLabel
              control={<Switch size="small" checked={tempIncludeDesc} onChange={e => setTempIncludeDesc(e.target.checked)} />}
              label={<Typography variant="body2">{t("includeDesc")}</Typography>}
            />
            <FormControlLabel
              control={<Switch size="small" checked={tempIncludeTags} onChange={e => setTempIncludeTags(e.target.checked)} />}
              label={<Typography variant="body2">{t("includeTags")}</Typography>}
            />
            <FormControlLabel
              control={<Switch size="small" checked={tempIncludeAuthor} onChange={e => setTempIncludeAuthor(e.target.checked)} />}
              label={<Typography variant="body2">{t("includeAuthor")}</Typography>}
            />
          </Box>
        </Box>
        
        <Divider />
        
        <Autocomplete
          multiple
          options={LOADERS as unknown as string[]}
          value={tempLoaders}
          onChange={(_, val) => setTempLoaders(val)}
          renderInput={(params) => <TextField {...params} label={t("platforms")} size="small" />}
          renderOption={(props, option) => {
            const info = getLoaderInfo(option);
            const { key, ...otherProps } = props;
            return (
              <li key={key} {...otherProps} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {info.icon && <Box sx={{ display: "flex", alignItems: "center", color: `${info.color}.main` }}>{info.icon}</Box>}
                {info.name}
              </li>
            );
          }}
          renderTags={(val, getTagProps) => val.map((option, idx) => {
            const info = getLoaderInfo(option);
            const { key, ...tagProps } = getTagProps({ index: idx });
            return (
              <Chip 
                key={key} 
                label={info.name} 
                size="small" 
                color={info.color as any}
                icon={info.icon}
                {...tagProps} 
              />
            );
          })}
        />

        <Autocomplete
          multiple
          options={MC_VERSIONS as unknown as string[]}
          value={tempMcVersions}
          onChange={(_, val) => setTempMcVersions(val)}
          renderInput={(params) => <TextField {...params} label={t("mcVersions")} size="small" />}
          renderTags={(val, getTagProps) => val.map((option, idx) => {
            const { key, ...tagProps } = getTagProps({ index: idx });
            return <Chip key={key} label={option} size="small" {...tagProps} />;
          })}
        />

        <Autocomplete
          multiple
          freeSolo
          options={PREDEFINED_TAGS as unknown as string[]}
          value={tempTags}
          onChange={(_, val) => setTempTags(val)}
          renderInput={(params) => <TextField {...params} label={t("tags")} size="small" />}
          renderOption={(props, option) => {
            const { key, ...otherProps } = props;
            let label = option;
            try { label = tTags(option as any); } catch {}
            return <li key={key} {...otherProps}>{label}</li>;
          }}
          renderTags={(val, getTagProps) => val.map((option, idx) => {
            const { key, ...tagProps } = getTagProps({ index: idx });
            let label = option;
            try { label = tTags(option as any); } catch {}
            return <Chip key={key} label={label} size="small" {...tagProps} />;
          })}
        />

      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="text">{tCommon("cancel")}</Button>
        <Button onClick={handleApply} variant="text" color="primary" sx={{ fontWeight: "bold" }}>{t("apply")}</Button>
      </DialogActions>
    </Dialog>
  );
}
