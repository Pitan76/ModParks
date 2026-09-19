"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { ChangeEvent } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/lib/i18n/routing";
import FormSelect from "@/components/ui/form/FormSelect";
import FormMultiSelect from "@/components/ui/form/FormMultiSelect";
import LoaderAutocomplete from "@/components/project/LoaderAutocomplete";
import McVersionAutocomplete from "@/components/project/McVersionAutocomplete";
import TagAutocomplete from "@/components/project/TagAutocomplete";
import { IDEA_STATUSES, IDEA_SORTS, ideaStatusLabelKey } from "@modparks/core/data/ideaFilters";

/** URL へ書き出す絞り込みの一式。項目が増えても呼び出し側の引数が増えないようまとめる */
type IdeaFilterState = {
  statuses: string[];
  sort: string;
  loaders: string[];
  mcVersions: string[];
  tags: string[];
};

export type IdeaSearchBarProps = {
  initialQ?: string;
  initialStatuses?: string[];
  initialSort?: string;
  initialLoaders?: string[];
  initialMcVersions?: string[];
  initialTags?: string[];
  availableTags?: { slug: string; name: string }[];
  availablePlatforms?: { slug: string; name: string }[];
};

/**
 * アイデア一覧の検索・絞り込みバー。
 *
 * プロジェクト一覧と同じく、状態は URL のクエリに持たせる（共有・戻る操作で再現できるため）。
 * 絞り込みの軸がプロジェクトより少ないため、詳細検索ダイアログには入れず全て表に出す。
 */
export default function IdeaSearchBar({
  initialQ = "",
  initialStatuses = [],
  initialSort = "newest",
  initialLoaders = [],
  initialMcVersions = [],
  initialTags = [],
  availableTags = [],
  availablePlatforms = [],
}: IdeaSearchBarProps) {
  const t = useTranslations("Idea");
  const tSearch = useTranslations("Search");
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(initialQ);
  const [debouncedQ, setDebouncedQ] = useState(initialQ);
  const [statuses, setStatuses] = useState<string[]>(initialStatuses);
  const [sort, setSort] = useState(initialSort);
  const [loaders, setLoaders] = useState<string[]>(initialLoaders);
  const [mcVersions, setMcVersions] = useState<string[]>(initialMcVersions);
  const [tags, setTags] = useState<string[]>(initialTags);
  const isFirstRender = useRef(true);

  const updateSearch = useCallback(
    (newQ: string, filters: IdeaFilterState) => {
      const params = new URLSearchParams();
      if (newQ) params.set("q", newQ);
      if (filters.statuses.length > 0 && filters.statuses.length < IDEA_STATUSES.length) {
        params.set("status", filters.statuses.join(","));
      }
      if (filters.sort && filters.sort !== "newest") params.set("sort", filters.sort);
      if (filters.loaders.length > 0) params.set("loaders", filters.loaders.join(","));
      if (filters.mcVersions.length > 0) params.set("mcVersions", filters.mcVersions.join(","));
      if (filters.tags.length > 0) params.set("tags", filters.tags.join(","));

      const qs = params.toString();
      startTransition(() => router.push(`${pathname}${qs ? `?${qs}` : ""}`));
    },
    [pathname, router],
  );

  // 入力のたびに遷移させない
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    updateSearch(debouncedQ, { statuses, sort, loaders, mcVersions, tags });
  }, [debouncedQ, statuses, sort, loaders, mcVersions, tags, updateSearch]);

  return (
    <Box sx={{ mb: 4 }}>
      <TextField
        id="idea-search-input"
        fullWidth
        placeholder={t("searchPlaceholder")}
        value={q}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
        sx={{ mb: 2 }}
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

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
        <Box sx={{ minWidth: 200 }}>
          <FormMultiSelect
            id="idea-status-filter"
            size="small"
            label={t("filters.status")}
            value={statuses}
            onChange={(e) => {
              const val = e.target.value;
              setStatuses(typeof val === "string" ? val.split(",") : (val as string[]));
            }}
            options={IDEA_STATUSES.map((status) => ({ value: status, label: t(ideaStatusLabelKey(status)) }))}
            renderSelected={(selected) => {
              if (selected.length === 0 || selected.length === IDEA_STATUSES.length) return tSearch("filters.all");
              return selected.map((v) => t(ideaStatusLabelKey(v))).join(", ");
            }}
          />
        </Box>

        <Box sx={{ minWidth: 180 }}>
          <FormSelect
            id="idea-sort"
            size="small"
            label={tSearch("sort.label")}
            value={sort}
            onChange={(e) => setSort(e.target.value as string)}
            options={IDEA_SORTS.map((value) => ({ value, label: t(`sort.${value}`) }))}
          />
        </Box>

        <Box sx={{ minWidth: 220, flex: "1 1 220px" }}>
          <LoaderAutocomplete
            availablePlatforms={availablePlatforms}
            loaders={loaders}
            onChange={setLoaders}
            label={tSearch("platforms")}
            size="small"
            required={false}
          />
        </Box>

        <Box sx={{ minWidth: 220, flex: "1 1 220px" }}>
          <McVersionAutocomplete
            value={mcVersions}
            onChange={setMcVersions}
            label={tSearch("mcVersions")}
            size="small"
            required={false}
          />
        </Box>

        <Box sx={{ minWidth: 220, flex: "1 1 220px" }}>
          <TagAutocomplete
            availableTags={availableTags}
            tags={tags}
            onChange={setTags}
            label={tSearch("tags")}
            size="small"
            required={false}
          />
        </Box>
      </Box>
    </Box>
  );
}
