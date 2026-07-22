"use client";

import AbstractDialog from "@/components/ui/AbstractDialog";
import FormAutocomplete from "@/components/ui/form/FormAutocomplete";
import FormTextField from "@/components/ui/form/FormTextField";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import { useTranslations } from "next-intl";
import { MC_VERSIONS } from "@/lib/validations";
import { getLoaderInfo } from "@/lib/loaders";
import { useState, useEffect } from "react";
import type { ChangeEvent } from "react";

export type AdvancedSearchFilters = {
  author?: string;
  loaders: string[];
  mcVersions: string[];
  tags: string[];
  searchMode: string;
  includeDesc: boolean;
  includeTags: boolean;
  includeAuthor: boolean;
  includeExtDl: boolean;
};

type OptionItem = {
  slug: string;
  name: string;
  inputValue?: string;
};

type AdvancedSearchDialogProps = {
  open: boolean;
  onClose: () => void;
  onApply: (filters: AdvancedSearchFilters) => void;
  initialFilters: AdvancedSearchFilters;
  availableTags?: OptionItem[];
  availablePlatforms?: OptionItem[];
};

/**
 * プロジェクト詳細検索用のモーダルダイアログ。
 * 対応ローダー、MCバージョン、タグ、作者名、および検索条件（AND/ORや説明文含めるか等）を指定できます。
 */
const AdvancedSearchDialog = ({
  open,
  onClose,
  onApply,
  initialFilters,
  availableTags = [],
  availablePlatforms = []
}: AdvancedSearchDialogProps) => {
  const t = useTranslations("Search");
  const tTags = useTranslations("Tags");

  const [tempAuthor, setTempAuthor] = useState<string>(initialFilters.author || "");
  const [tempLoaders, setTempLoaders] = useState<string[]>(initialFilters.loaders);
  const [tempMcVersions, setTempMcVersions] = useState<string[]>(initialFilters.mcVersions);
  const [tempTags, setTempTags] = useState<string[]>(initialFilters.tags);
  const [tempSearchMode, setTempSearchMode] = useState(initialFilters.searchMode);
  const [tempIncludeDesc, setTempIncludeDesc] = useState(initialFilters.includeDesc);
  const [tempIncludeTags, setTempIncludeTags] = useState(initialFilters.includeTags);
  const [tempIncludeAuthor, setTempIncludeAuthor] = useState(initialFilters.includeAuthor);
  const [tempIncludeExtDl, setTempIncludeExtDl] = useState(initialFilters.includeExtDl);

  useEffect(() => {
    if (open) {
      setTempAuthor(initialFilters.author || "");
      setTempLoaders(initialFilters.loaders);
      setTempMcVersions(initialFilters.mcVersions);
      setTempTags(initialFilters.tags);
      setTempSearchMode(initialFilters.searchMode);
      setTempIncludeDesc(initialFilters.includeDesc);
      setTempIncludeTags(initialFilters.includeTags);
      setTempIncludeAuthor(initialFilters.includeAuthor);
      setTempIncludeExtDl(initialFilters.includeExtDl);
    }
  }, [open, initialFilters]);

  const handleApply = () => {
    onApply({
      author: tempAuthor,
      loaders: tempLoaders,
      mcVersions: tempMcVersions,
      tags: tempTags,
      searchMode: tempSearchMode,
      includeDesc: tempIncludeDesc,
      includeTags: tempIncludeTags,
      includeAuthor: tempIncludeAuthor,
      includeExtDl: tempIncludeExtDl,
    });
  };

  return (
    <AbstractDialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      title={t("advancedSearch")}
      onConfirm={handleApply}
      onCancel={onClose}
      confirmText={t("apply")}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3, pt: 2 }}>
        
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Typography variant="subtitle2" color="text.secondary">{t("keywordOptions")}</Typography>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <RadioGroup
              row
              value={tempSearchMode}
              onChange={(e) => setTempSearchMode(e.target.value)}
            >
              <FormControlLabel value="OR" control={<Radio size="small" />} label="OR" />
              <FormControlLabel value="AND" control={<Radio size="small" />} label="AND" />
            </RadioGroup>
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
            <FormControlLabel
              control={<Switch size="small" checked={tempIncludeExtDl} onChange={e => setTempIncludeExtDl(e.target.checked)} />}
              label={<Typography variant="body2">{t("includeExtDl")}</Typography>}
            />
          </Box>
        </Box>
        
        <Divider />

        <FormTextField
          label={t("author") || "Author (Username)"}
          size="small"
          value={tempAuthor}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setTempAuthor(e.target.value)}
          placeholder="e.g. pitan76"
          fullWidth
        />
        
        {/* @ts-ignore */}
        <FormAutocomplete
          multiple
          options={availablePlatforms}
          getOptionLabel={(option: OptionItem | string) => {
            if (typeof option === "string") return option;
            return option.name || option.slug || "";
          }}
          value={availablePlatforms.filter(p => tempLoaders.includes(p.slug)) as any}
          onChange={(_, val: (OptionItem | string)[]) => setTempLoaders(val.map(v => typeof v === "string" ? v : v.slug))}
          label={t("platforms")}
          renderInputProps={{ size: "small" }}
          renderOption={(props, option: OptionItem | string) => {
            const slug = typeof option === "string" ? option : option.slug;
            const name = typeof option === "string" ? option : option.name;
            const info = getLoaderInfo(slug);
            const { key, ...otherProps } = props;
            return (
              <li key={key} {...otherProps} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {info.icon && <Box sx={{ display: "flex", alignItems: "center", color: `${info.color}.main` }}>{info.icon}</Box>}
                {name}
              </li>
            );
          }}
          // @ts-ignore
          renderTags={(val: (OptionItem | string)[], getTagProps) => val.map((option, idx) => {
            const slug = typeof option === "string" ? option : option.slug;
            const name = typeof option === "string" ? option : option.name;
            const info = getLoaderInfo(slug);
            const { key, ...tagProps } = getTagProps({ index: idx });
            return (
              <Chip 
                key={key} 
                label={name} 
                size="small" 
                color={info.color as any}
                icon={info.icon}
                {...tagProps} 
              />
            );
          })}
        />

        {/* @ts-ignore */}
        <FormAutocomplete
          multiple
          options={MC_VERSIONS as unknown as string[]}
          value={tempMcVersions}
          onChange={(_, val) => setTempMcVersions(val)}
          label={t("mcVersions")}
          renderInputProps={{ size: "small" }}
          // @ts-ignore
          renderTags={(val: any, getTagProps: any) => val.map((option: any, idx: any) => {
            const { key, ...tagProps } = getTagProps({ index: idx });
            return <Chip key={key} label={option} size="small" {...tagProps} />;
          })}
        />

        {/* @ts-ignore */}
        <FormAutocomplete
          multiple
          freeSolo
          options={availableTags}
          getOptionLabel={(option: OptionItem | string) => {
            const slug = typeof option === "string" ? option : option.slug;
            try {
              const translated = tTags(slug as any);
              if (translated && !translated.includes(".")) return translated;
            } catch {}
            if (typeof option === "string") return option;
            return option.name || option.slug || "";
          }}
          value={tempTags as any}
          onChange={(_, val: (OptionItem | string)[]) => setTempTags(val.map(v => typeof v === "string" ? v : v.slug || v.inputValue || ""))}
          label={t("tags")}
          renderInputProps={{ size: "small" }}
          renderOption={(props, option: OptionItem | string) => {
            const slug = typeof option === "string" ? option : option.slug;
            let label = typeof option === "string" ? option : option.name;
            try {
              const translated = tTags(slug as any);
              if (translated && !translated.includes(".")) label = translated;
            } catch {}
            const { key, ...otherProps } = props;
            return <li key={key} {...otherProps}>{label}</li>;
          }}
          // @ts-ignore
          renderTags={(val: (OptionItem | string)[], getTagProps) => val.map((option, idx) => {
            const slug = typeof option === "string" ? option : option.slug;
            const foundObj = availableTags.find(tObj => tObj.slug === slug);
            let label = foundObj ? foundObj.name : slug;
            try { 
              const translated = tTags(slug as any);
              if (translated && !translated.includes(".")) label = translated;
            } catch {}
            const { key, ...tagProps } = getTagProps({ index: idx });
            return <Chip key={key} label={label} size="small" {...tagProps} />;
          })}
        />

      </Box>
    </AbstractDialog>
  );
};

export default AdvancedSearchDialog;
