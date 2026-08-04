"use client";

import AbstractDialog from "@/components/ui/AbstractDialog";
import FormTextField from "@/components/ui/form/FormTextField";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import { useTranslations } from "next-intl";
import McVersionAutocomplete from "./McVersionAutocomplete";
import LoaderAutocomplete from "./LoaderAutocomplete";
import { useState, useEffect } from "react";
import type { ChangeEvent } from "react";
import TagAutocomplete from "./TagAutocomplete";
import LicenseAutocomplete from "./LicenseAutocomplete";

export type AdvancedSearchFilters = {
  author?: string;
  loaders: string[];
  mcVersions: string[];
  tags: string[];
  licenses: string[];
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

  const [tempAuthor, setTempAuthor] = useState<string>(initialFilters.author || "");
  const [tempLoaders, setTempLoaders] = useState<string[]>(initialFilters.loaders);
  const [tempMcVersions, setTempMcVersions] = useState<string[]>(initialFilters.mcVersions);
  const [tempTags, setTempTags] = useState<string[]>(initialFilters.tags);
  const [tempLicenses, setTempLicenses] = useState<string[]>(initialFilters.licenses || []);
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
      setTempLicenses(initialFilters.licenses || []);
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
      licenses: tempLicenses,
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
        
        <LoaderAutocomplete
          availablePlatforms={availablePlatforms}
          loaders={tempLoaders}
          onChange={setTempLoaders}
          label={t("platforms")}
          size="small"
          required={false}
        />

        <McVersionAutocomplete
          value={tempMcVersions}
          onChange={setTempMcVersions}
          label={t("mcVersions")}
          size="small"
          required={false}
        />

        <TagAutocomplete
          availableTags={availableTags}
          tags={tempTags}
          onChange={setTempTags}
          label={t("tags")}
          size="small"
          required={false}
        />

        <LicenseAutocomplete
          value={tempLicenses}
          onChange={setTempLicenses}
          label={t("licenses")}
          size="small"
          required={false}
        />

      </Box>
    </AbstractDialog>
  );
};

export default AdvancedSearchDialog;
