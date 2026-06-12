"use client";

import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import { useTranslations } from "next-intl";
import { useCallback, useState, useTransition } from "react";

interface ProjectSearchBarProps {
  initialQ?:    string;
  initialType?: string;
}

export default function ProjectSearchBar({ initialQ = "", initialType = "all" }: ProjectSearchBarProps) {
  const t       = useTranslations("Search");
  const router  = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const [q,    setQ]    = useState(initialQ);
  const [type, setType] = useState(initialType || "all");

  const updateSearch = useCallback(
    (newQ: string, newType: string) => {
      const params = new URLSearchParams();
      if (newQ)               params.set("q", newQ);
      if (newType !== "all")  params.set("type", newType);
      const qs = params.toString();
      startTransition(() => {
        router.push(`${pathname}${qs ? `?${qs}` : ""}`);
      });
    },
    [pathname, router]
  );

  return (
    <Box sx={{ mb: 4 }}>
      <TextField
        id="project-search-input"
        fullWidth
        placeholder={t("placeholder")}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          updateSearch(e.target.value, type);
        }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: "text.disabled" }} />
              </InputAdornment>
            ),
          },
        }}
        sx={{ mb: 2 }}
      />

      <ToggleButtonGroup
        id="type-filter"
        value={type}
        exclusive
        onChange={(_, v) => {
          if (!v) return;
          setType(v);
          updateSearch(q, v);
        }}
        size="small"
      >
        <ToggleButton value="all"    id="filter-all">    すべて  </ToggleButton>
        <ToggleButton value="mod"    id="filter-mod">    Mod     </ToggleButton>
        <ToggleButton value="plugin" id="filter-plugin"> Plugin  </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}
