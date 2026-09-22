"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { ChangeEvent } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import TuneIcon from "@mui/icons-material/Tune";
import IconButton from "@mui/material/IconButton";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/lib/i18n/routing";
import FormSelect from "@/components/ui/form/FormSelect";
import FormMultiSelect from "@/components/ui/form/FormMultiSelect";
import { IDEA_STATUSES, IDEA_SORTS, ideaStatusLabelKey } from "@modparks/core/data/ideaFilters";
import type { IdeaDetailFilters } from "./IdeaFilterDialog";

// ダイアログは開くまで不要なので遅延ロードする（プロジェクト一覧の詳細検索と同じ）
const IdeaFilterDialog = dynamic(() => import("./IdeaFilterDialog"), { ssr: false });

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
 * 見た目もプロジェクト一覧に揃え、状態と並び替えだけを表に出し、残りはダイアログに入れる。
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
  const [detail, setDetail] = useState<IdeaDetailFilters>({ loaders: initialLoaders, mcVersions: initialMcVersions, tags: initialTags });
  const [filterOpen, setFilterOpen] = useState(false);
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
    updateSearch(debouncedQ, { statuses, sort, ...detail });
  }, [debouncedQ, statuses, sort, detail, updateSearch]);

  const isDetailActive = detail.loaders.length > 0 || detail.mcVersions.length > 0 || detail.tags.length > 0;

  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 2 }}>
        <TextField
          id="idea-search-input"
          fullWidth
          placeholder={t("searchPlaceholder")}
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
          onClick={() => setFilterOpen(true)}
          color={isDetailActive ? "primary" : "default"}
          aria-label={tSearch("advancedSearch")}
          sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}
        >
          <TuneIcon />
        </IconButton>
      </Box>

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
      </Box>

      {filterOpen && (
        <IdeaFilterDialog
          onClose={() => setFilterOpen(false)}
          initialFilters={detail}
          availableTags={availableTags}
          availablePlatforms={availablePlatforms}
          onApply={(filters) => {
            setDetail(filters);
            setFilterOpen(false);
          }}
        />
      )}
    </Box>
  );
}
