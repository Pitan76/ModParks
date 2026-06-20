"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import { useTranslations } from "next-intl";

export default function ProfileSortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("Search.sort");
  
  const sort = searchParams?.get("sort") || "updated";

  const handleChange = (newSort: string) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("sort", newSort);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <FormControl size="small" sx={{ minWidth: 140 }}>
      <InputLabel id="profile-sort-label">{t("label")}</InputLabel>
      <Select
        labelId="profile-sort-label"
        value={sort}
        label={t("label")}
        onChange={(e) => handleChange(e.target.value)}
      >
        <MenuItem value="updated">{t("updated")}</MenuItem>
        <MenuItem value="downloads">{t("downloads")}</MenuItem>
        <MenuItem value="newest">{t("newest")}</MenuItem>
      </Select>
    </FormControl>
  );
}
