"use client";

import { useRouter, usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import { useTranslations } from "next-intl";
import { useCallback, useState, useTransition } from "react";

interface ProjectSearchBarProps {
  initialQ?: string;
  initialType?: string;
  initialSort?: string;
  initialLoader?: string;
  initialMcVersion?: string;
}

export default function ProjectSearchBar({ 
  initialQ = "", 
  initialType = "all",
  initialSort = "updated",
  initialLoader = "all",
  initialMcVersion = "all"
}: ProjectSearchBarProps) {
  const t       = useTranslations("Search");
  const router  = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(initialQ);
  const [type, setType] = useState(initialType || "all");
  const [sort, setSort] = useState(initialSort || "updated");
  const [loader, setLoader] = useState(initialLoader || "all");
  const [mcVersion, setMcVersion] = useState(initialMcVersion || "all");

  const updateSearch = useCallback(
    (newQ: string, newType: string, newSort: string, newLoader: string, newMcVersion: string) => {
      const params = new URLSearchParams();
      if (newQ) params.set("q", newQ);
      if (newType && newType !== "all") params.set("type", newType);
      if (newSort && newSort !== "updated") params.set("sort", newSort);
      if (newLoader && newLoader !== "all") params.set("loader", newLoader);
      if (newMcVersion && newMcVersion !== "all") params.set("mcVersion", newMcVersion);
      
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
          updateSearch(e.target.value, type, sort, loader, mcVersion);
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

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <ToggleButtonGroup
          id="type-filter"
          value={type}
          exclusive
          onChange={(_, v) => {
            if (!v) return;
            setType(v);
            updateSearch(q, v, sort, loader, mcVersion);
          }}
          size="small"
        >
          <ToggleButton value="all"    id="filter-all">    すべて  </ToggleButton>
          <ToggleButton value="mod"    id="filter-mod">    Mod     </ToggleButton>
          <ToggleButton value="plugin" id="filter-plugin"> Plugin  </ToggleButton>
        </ToggleButtonGroup>

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel id="sort-select-label">並び順</InputLabel>
          <Select
            labelId="sort-select-label"
            value={sort}
            label="並び順"
            onChange={(e) => {
              setSort(e.target.value);
              updateSearch(q, type, e.target.value, loader, mcVersion);
            }}
          >
            <MenuItem value="updated">更新日順</MenuItem>
            <MenuItem value="downloads">ダウンロード順</MenuItem>
            <MenuItem value="newest">新着順</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel id="loader-select-label">ローダー</InputLabel>
          <Select
            labelId="loader-select-label"
            value={loader}
            label="ローダー"
            onChange={(e) => {
              setLoader(e.target.value);
              updateSearch(q, type, sort, e.target.value, mcVersion);
            }}
          >
            <MenuItem value="all">すべて</MenuItem>
            <MenuItem value="Fabric">Fabric</MenuItem>
            <MenuItem value="Forge">Forge</MenuItem>
            <MenuItem value="NeoForge">NeoForge</MenuItem>
            <MenuItem value="Quilt">Quilt</MenuItem>
            <MenuItem value="Paper">Paper</MenuItem>
            <MenuItem value="Spigot">Spigot</MenuItem>
            <MenuItem value="Purpur">Purpur</MenuItem>
          </Select>
        </FormControl>
      </Box>
    </Box>
  );
}
