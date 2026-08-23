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
import { IDEA_STATUSES, IDEA_SORTS, ideaStatusLabelKey } from "@/lib/data/ideaFilters";

export type IdeaSearchBarProps = {
  initialQ?: string;
  initialStatuses?: string[];
  initialSort?: string;
};

/**
 * アイデア一覧の検索・絞り込みバー。
 *
 * プロジェクト一覧と同じく、状態は URL のクエリに持たせる（共有・戻る操作で再現できるため）。
 * アイデアには種別やローダーの軸が無いので、詳細検索ダイアログは持たない。
 */
export default function IdeaSearchBar({ initialQ = "", initialStatuses = [], initialSort = "newest" }: IdeaSearchBarProps) {
  const t = useTranslations("Idea");
  const tSearch = useTranslations("Search");
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(initialQ);
  const [debouncedQ, setDebouncedQ] = useState(initialQ);
  const [statuses, setStatuses] = useState<string[]>(initialStatuses);
  const [sort, setSort] = useState(initialSort);
  const isFirstRender = useRef(true);

  const updateSearch = useCallback(
    (newQ: string, newStatuses: string[], newSort: string) => {
      const params = new URLSearchParams();
      if (newQ) params.set("q", newQ);
      if (newStatuses.length > 0 && newStatuses.length < IDEA_STATUSES.length) params.set("status", newStatuses.join(","));
      if (newSort && newSort !== "newest") params.set("sort", newSort);

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
    updateSearch(debouncedQ, statuses, sort);
  }, [debouncedQ, statuses, sort, updateSearch]);

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
      </Box>
    </Box>
  );
}
