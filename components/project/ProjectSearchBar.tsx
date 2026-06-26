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
import IconButton from "@mui/material/IconButton";
import { useTranslations } from "next-intl";
import { useCallback, useState, useTransition, useEffect, useRef } from "react";
import AdvancedSearchDialog, { AdvancedSearchFilters } from "./AdvancedSearchDialog";

interface ProjectSearchBarProps {
  initialQ?: string;
  initialAuthor?: string;
  initialTypes?: string[];
  initialSort?: string;
  initialLoaders?: string[];
  initialMcVersions?: string[];
  initialTags?: string[];
  initialSearchMode?: string;
  initialIncludeDesc?: boolean;
  initialIncludeTags?: boolean;
  initialIncludeAuthor?: boolean;
  initialIncludeExtDl?: boolean;
  availableTags?: { slug: string; name: string }[];
  availablePlatforms?: { slug: string; name: string }[];
}

export default function ProjectSearchBar({ 
  initialQ = "", 
  initialAuthor = "",
  initialTypes = ["mod", "plugin", "resourcepack", "datapack", "shader", "modpack"],
  initialSort = "updated",
  initialLoaders = [],
  initialMcVersions = [],
  initialTags = [],
  initialSearchMode = "OR",
  initialIncludeDesc = true,
  initialIncludeTags = true,
  initialIncludeAuthor = true,
  initialIncludeExtDl = false,
  availableTags = [],
  availablePlatforms = []
}: ProjectSearchBarProps) {
  const t = useTranslations("Search");
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(initialQ);
  const [debouncedQ, setDebouncedQ] = useState(initialQ);
  
  // Real-time state for UI outside dialog
  const [types, setTypes] = useState<string[]>(initialTypes);
  const [appliedSort, setAppliedSort] = useState(initialSort);

  // Advanced search filters state
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedSearchFilters>({
    author: initialAuthor,
    loaders: initialLoaders,
    mcVersions: initialMcVersions,
    tags: initialTags,
    searchMode: initialSearchMode,
    includeDesc: initialIncludeDesc,
    includeTags: initialIncludeTags,
    includeAuthor: initialIncludeAuthor,
    includeExtDl: initialIncludeExtDl,
  });

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const isFirstRender = useRef(true);

  const updateSearch = useCallback(
    (newQ: string, newTypes: string[], newSort: string, filters: AdvancedSearchFilters) => {
      const params = new URLSearchParams();
      if (newQ) params.set("q", newQ);
      if (filters.author) params.set("author", filters.author);
      if (newTypes.length > 0 && newTypes.length < 6) params.set("types", newTypes.join(","));
      if (newSort && newSort !== "updated") params.set("sort", newSort);
      
      if (filters.loaders.length > 0) params.set("loaders", filters.loaders.join(","));
      if (filters.mcVersions.length > 0) params.set("mcVersions", filters.mcVersions.join(","));
      if (filters.tags.length > 0) params.set("tags", filters.tags.join(","));
      
      if (filters.searchMode !== "OR") params.set("searchMode", filters.searchMode);
      if (!filters.includeDesc) params.set("includeDesc", "false");
      if (!filters.includeTags) params.set("includeTags", "false");
      if (!filters.includeAuthor) params.set("includeAuthor", "false");
      if (filters.includeExtDl) params.set("includeExtDl", "true");
      
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
    updateSearch(debouncedQ, types, appliedSort, advancedFilters);
  }, [debouncedQ, types, appliedSort, advancedFilters, updateSearch]);

  const isAdvancedActive = 
    !!advancedFilters.author ||
    advancedFilters.loaders.length > 0 || 
    advancedFilters.mcVersions.length > 0 || 
    advancedFilters.tags.length > 0 || 
    appliedSort !== "updated" || 
    advancedFilters.searchMode !== "OR" || 
    !advancedFilters.includeDesc || 
    !advancedFilters.includeTags || 
    !advancedFilters.includeAuthor ||
    advancedFilters.includeExtDl;

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
          onClick={() => setAdvancedOpen(true)} 
          color={isAdvancedActive ? "primary" : "default"}
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
          <ToggleButton value="resourcepack" id="filter-resourcepack">{t("filters.resourcepack")}</ToggleButton>
          <ToggleButton value="datapack" id="filter-datapack">{t("filters.datapack")}</ToggleButton>
          <ToggleButton value="shader" id="filter-shader">{t("filters.shader")}</ToggleButton>
          <ToggleButton value="modpack" id="filter-modpack">{t("filters.modpack")}</ToggleButton>
        </ToggleButtonGroup>

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="sort-select-label-main">{t("sort.label")}</InputLabel>
          <Select
            labelId="sort-select-label-main"
            value={appliedSort}
            label={t("sort.label")}
            onChange={(e) => setAppliedSort(e.target.value)}
          >
            <MenuItem value="updated">{t("sort.updated")}</MenuItem>
            <MenuItem value="downloads">{t("sort.downloads")}</MenuItem>
            <MenuItem value="newest">{t("sort.newest")}</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <AdvancedSearchDialog
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        initialFilters={advancedFilters}
        availableTags={availableTags}
        availablePlatforms={availablePlatforms}
        onApply={(filters) => {
          setAdvancedFilters(filters);
          setAdvancedOpen(false);
        }}
      />
    </Box>
  );
}
