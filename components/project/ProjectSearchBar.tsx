"use client";

import { useRouter, usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import TuneIcon from "@mui/icons-material/Tune";
import IconButton from "@mui/material/IconButton";
import FormSelect from "@/components/ui/form/FormSelect";
import FormMultiSelect from "@/components/ui/form/FormMultiSelect";
import { useTranslations } from "next-intl";
import { useCallback, useState, useTransition, useEffect, useRef } from "react";
import type { ChangeEvent } from "react";
import dynamic from "next/dynamic";
import type { AdvancedSearchFilters } from "./AdvancedSearchDialog";

// ダイアログは開くまで不要なので client 専用で遅延ロードし、サーバーバンドルから外す。
const AdvancedSearchDialog = dynamic(() => import("./AdvancedSearchDialog"), { ssr: false });

export type ProjectSearchBarProps = {
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
};

/**
 * プロジェクト一覧の検索・フィルターバーコンポーネント。
 * キーワード入力、タイプフィルター、ソート変更、および詳細検索ダイアログへのアクセスを提供します。
 */
const ProjectSearchBar = ({ 
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
}: ProjectSearchBarProps) => {
  const t = useTranslations("Search");
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(initialQ);
  const [debouncedQ, setDebouncedQ] = useState(initialQ);
  
  const [types, setTypes] = useState<string[]>(initialTypes);
  const [appliedSort, setAppliedSort] = useState(initialSort);

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
          onChange={(e: ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
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
        <Box sx={{ minWidth: 200 }}>
          <FormMultiSelect
            id="type-filter"
            size="small"
            label={t("filters.type")}
            value={types}
            onChange={(e) => {
              const val = e.target.value;
              const newTypes = typeof val === "string" ? val.split(",") : (val as string[]);
              if (newTypes.length === 0) return; // Prevent unselecting all
              setTypes(newTypes);
            }}
            options={[
              { value: "mod", label: t("filters.mod") },
              { value: "plugin", label: t("filters.plugin") },
              { value: "resourcepack", label: t("filters.resourcepack") },
              { value: "datapack", label: t("filters.datapack") },
              { value: "shader", label: t("filters.shader") },
              { value: "modpack", label: t("filters.modpack") },
            ]}
            renderSelected={(selected) => {
              if (selected.length === 6) return t("filters.all");
              if (selected.length >= 4) return selected.slice(0, 3).map((v) => t(`filters.${v}`)).join(", ") + "...";
              return selected.map((v) => t(`filters.${v}`)).join(", ");
            }}
          />
        </Box>

        <Box sx={{ minWidth: 150 }}>
          <FormSelect
            id="sort-select"
            size="small"
            label={t("sort.label")}
            value={appliedSort}
            onChange={(e) => setAppliedSort(e.target.value as string)}
            options={[
              { value: "updated", label: t("sort.updated") },
              { value: "downloads", label: t("sort.downloads") },
              { value: "newest", label: t("sort.newest") },
            ]}
          />
        </Box>
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
};

export default ProjectSearchBar;
