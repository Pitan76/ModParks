"use client";

import { useRouter, usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import TuneIcon from "@mui/icons-material/Tune";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Autocomplete from "@mui/material/Autocomplete";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import { useTranslations } from "next-intl";
import { useCallback, useState, useTransition, useEffect, useRef } from "react";
import { LOADERS, MC_VERSIONS } from "@/lib/validations";

interface ProjectSearchBarProps {
  initialQ?: string;
  initialTypes?: string[];
  initialSort?: string;
  initialLoaders?: string[];
  initialMcVersions?: string[];
  initialTags?: string[];
}

export default function ProjectSearchBar({ 
  initialQ = "", 
  initialTypes = ["mod", "plugin"],
  initialSort = "updated",
  initialLoaders = [],
  initialMcVersions = [],
  initialTags = []
}: ProjectSearchBarProps) {
  const t       = useTranslations("Search");
  const tCommon = useTranslations("Common");
  const router  = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(initialQ);
  const [debouncedQ, setDebouncedQ] = useState(initialQ);
  
  // Real-time state for UI outside dialog
  const [types, setTypes] = useState<string[]>(initialTypes);

  // Applied advanced state (what's actually in the URL)
  const [appliedSort, setAppliedSort] = useState(initialSort);
  const [appliedLoaders, setAppliedLoaders] = useState<string[]>(initialLoaders);
  const [appliedMcVersions, setAppliedMcVersions] = useState<string[]>(initialMcVersions);
  const [appliedTags, setAppliedTags] = useState<string[]>(initialTags);

  // Dialog internal state (not applied until "Apply" is clicked)
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [tempSort, setTempSort] = useState(initialSort);
  const [tempLoaders, setTempLoaders] = useState<string[]>(initialLoaders);
  const [tempMcVersions, setTempMcVersions] = useState<string[]>(initialMcVersions);
  const [tempTags, setTempTags] = useState<string[]>(initialTags);

  const isFirstRender = useRef(true);

  const updateSearch = useCallback(
    (newQ: string, newTypes: string[], newSort: string, newLoaders: string[], newMcVersions: string[], newTags: string[]) => {
      const params = new URLSearchParams();
      if (newQ) params.set("q", newQ);
      if (newTypes.length > 0 && newTypes.length < 2) params.set("types", newTypes.join(","));
      if (newSort && newSort !== "updated") params.set("sort", newSort);
      if (newLoaders.length > 0) params.set("loaders", newLoaders.join(","));
      if (newMcVersions.length > 0) params.set("mcVersions", newMcVersions.join(","));
      if (newTags.length > 0) params.set("tags", newTags.join(","));
      
      const qs = params.toString();
      startTransition(() => {
        router.push(`${pathname}${qs ? `?${qs}` : ""}`);
      });
    },
    [pathname, router]
  );

  // Debounce query string
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(q);
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  // Trigger update when any "applied" state changes
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    updateSearch(debouncedQ, types, appliedSort, appliedLoaders, appliedMcVersions, appliedTags);
  }, [debouncedQ, types, appliedSort, appliedLoaders, appliedMcVersions, appliedTags, updateSearch]);

  const handleOpenAdvanced = () => {
    setTempSort(appliedSort);
    setTempLoaders(appliedLoaders);
    setTempMcVersions(appliedMcVersions);
    setTempTags(appliedTags);
    setAdvancedOpen(true);
  };

  const handleApplyAdvanced = () => {
    setAppliedSort(tempSort);
    setAppliedLoaders(tempLoaders);
    setAppliedMcVersions(tempMcVersions);
    setAppliedTags(tempTags);
    setAdvancedOpen(false);
  };

  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 2 }}>
        <TextField
          id="project-search-input"
          fullWidth
          placeholder={t("placeholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: "text.disabled" }} />
                </InputAdornment>
              ),
            },
          }}
        />
        <IconButton 
          onClick={handleOpenAdvanced} 
          color={(appliedLoaders.length > 0 || appliedMcVersions.length > 0 || appliedTags.length > 0 || appliedSort !== "updated") ? "primary" : "default"}
          sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}
        >
          <TuneIcon />
        </IconButton>
      </Box>

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
        <ToggleButtonGroup
          id="type-filter"
          value={types}
          onChange={(_, v) => {
            if (v.length === 0) return; // Prevent unselecting both
            setTypes(v);
          }}
          size="small"
        >
          <ToggleButton value="mod" id="filter-mod">{t("filters.mod")}</ToggleButton>
          <ToggleButton value="plugin" id="filter-plugin">{t("filters.plugin")}</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Advanced Search Dialog */}
      <Dialog open={advancedOpen} onClose={() => setAdvancedOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t("advancedSearch")}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 3, pt: 2 }}>
          
          <FormControl size="small" fullWidth sx={{ mt: 1 }}>
            <InputLabel id="sort-select-label">{t("sort.label")}</InputLabel>
            <Select
              labelId="sort-select-label"
              value={tempSort}
              label={t("sort.label")}
              onChange={(e) => setTempSort(e.target.value)}
            >
              <MenuItem value="updated">{t("sort.updated")}</MenuItem>
              <MenuItem value="downloads">{t("sort.downloads")}</MenuItem>
              <MenuItem value="newest">{t("sort.newest")}</MenuItem>
            </Select>
          </FormControl>

          <Autocomplete
            multiple
            options={LOADERS as unknown as string[]}
            value={tempLoaders}
            onChange={(_, val) => setTempLoaders(val)}
            renderInput={(params) => <TextField {...params} label={t("platforms")} size="small" />}
            renderTags={(val, getTagProps) => val.map((option, idx) => {
              const { key, ...tagProps } = getTagProps({ index: idx });
              return <Chip key={key} label={option} size="small" {...tagProps} />;
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
            options={[] as string[]}
            value={tempTags}
            onChange={(_, val) => setTempTags(val)}
            renderInput={(params) => <TextField {...params} label={t("tags")} size="small" />}
            renderTags={(val, getTagProps) => val.map((option, idx) => {
              const { key, ...tagProps } = getTagProps({ index: idx });
              return <Chip key={key} label={option} size="small" {...tagProps} />;
            })}
          />

        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdvancedOpen(false)} variant="text">{tCommon("cancel")}</Button>
          <Button onClick={handleApplyAdvanced} variant="contained" color="primary">{t("apply")}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
