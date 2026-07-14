"use client";

import { useRouter, usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import TuneIcon from "@mui/icons-material/Tune";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import IconButton from "@mui/material/IconButton";
import OutlinedInput from "@mui/material/OutlinedInput";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
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
          sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}
        >
          <TuneIcon />
        </IconButton>
      </Box>

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="type-select-label">{t("filters.type")}</InputLabel>
          <Select
            labelId="type-select-label"
            id="type-filter"
            multiple
            value={types}
            onChange={(e) => {
              const val = e.target.value;
              const newTypes = typeof val === "string" ? val.split(",") : (val as string[]);
              if (newTypes.length === 0) return; // Prevent unselecting all
              setTypes(newTypes);
            }}
            input={<OutlinedInput label={t("filters.type")} />}
            renderValue={(selected) => {
              if (selected.length === 6) {
                return t("filters.all");
              }
              return selected.map((v) => t(`filters.${v}`)).join(", ");
            }}
          >
            <MenuItem value="mod" id="filter-mod">
              <Checkbox checked={types.indexOf("mod") > -1} />
              <ListItemText primary={t("filters.mod")} />
            </MenuItem>
            <MenuItem value="plugin" id="filter-plugin">
              <Checkbox checked={types.indexOf("plugin") > -1} />
              <ListItemText primary={t("filters.plugin")} />
            </MenuItem>
            <MenuItem value="resourcepack" id="filter-resourcepack">
              <Checkbox checked={types.indexOf("resourcepack") > -1} />
              <ListItemText primary={t("filters.resourcepack")} />
            </MenuItem>
            <MenuItem value="datapack" id="filter-datapack">
              <Checkbox checked={types.indexOf("datapack") > -1} />
              <ListItemText primary={t("filters.datapack")} />
            </MenuItem>
            <MenuItem value="shader" id="filter-shader">
              <Checkbox checked={types.indexOf("shader") > -1} />
              <ListItemText primary={t("filters.shader")} />
            </MenuItem>
            <MenuItem value="modpack" id="filter-modpack">
              <Checkbox checked={types.indexOf("modpack") > -1} />
              <ListItemText primary={t("filters.modpack")} />
            </MenuItem>
          </Select>
        </FormControl>

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
