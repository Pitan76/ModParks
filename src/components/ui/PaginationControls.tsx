"use client";

import { useSearchParams } from "next/navigation";
import { useRouter, usePathname } from "@/lib/i18n/routing";
import { useTranslations } from "next-intl";
import Pagination from "@mui/material/Pagination";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import type { SxProps, Theme } from "@mui/material/styles";
import MenuItem from "@mui/material/MenuItem";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useColorMode } from "@/components/ThemeRegistry";
import PlainPaginationControls from "@/components/plain/ui/PlainPaginationControls";

const LIMIT_OPTIONS = [10, 20, 30, 40, 50, 60, 70, 80];

interface PaginationControlsProps {
  totalCount: number;
  currentPage: number;
  currentLimit: number;
  sx?: SxProps<Theme>;
}

export default function PaginationControls({ totalCount, currentPage, currentLimit, sx }: PaginationControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("Common");
  const { isPlainTheme } = useColorMode();

  const totalPages = Math.max(1, Math.ceil(totalCount / currentLimit));

  const createQueryString = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
    params.set(name, value);
    if (name === "limit") {
      params.set("page", "1"); // Reset to page 1 when limit changes
    }
    return params.toString();
  };

  const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
    router.push(`${pathname}?${createQueryString("page", value.toString())}`);
  };

  const handleLimitChange = (event: SelectChangeEvent<number>) => {
    router.push(`${pathname}?${createQueryString("limit", String(event.target.value))}`);
  };

  if (totalCount === 0) return null;

  if (isPlainTheme) {
    return (
      <PlainPaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        currentLimit={currentLimit}
        limitOptions={LIMIT_OPTIONS}
        buildPageHref={(page) => `${pathname}?${createQueryString("page", page.toString())}`}
        onLimitChange={(limit) => router.push(`${pathname}?${createQueryString("limit", limit.toString())}`)}
      />
    );
  }

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", mt: 4, gap: 2, ...sx }}>
      <Pagination 
        count={totalPages} 
        page={currentPage} 
        onChange={handlePageChange} 
        color="primary" 
      />
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" color="text.secondary">{t("itemsPerPage")}:</Typography>
        <Select
          size="small"
          value={currentLimit}
          onChange={handleLimitChange}
          sx={{ minWidth: 80 }}
        >
          {LIMIT_OPTIONS.map((option) => (
            <MenuItem key={option} value={option}>{option}</MenuItem>
          ))}
        </Select>
      </Box>
    </Box>
  );
}
