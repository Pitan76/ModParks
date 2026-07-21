"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Pagination from "@mui/material/Pagination";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface PaginationControlsProps {
  totalCount: number;
  currentPage: number;
  currentLimit: number;
  sx?: any;
}

export default function PaginationControls({ totalCount, currentPage, currentLimit, sx }: PaginationControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("Common");

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

  const handleLimitChange = (event: any) => {
    router.push(`${pathname}?${createQueryString("limit", event.target.value)}`);
  };

  if (totalCount === 0) return null;

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
          <MenuItem value={10}>10</MenuItem>
          <MenuItem value={20}>20</MenuItem>
          <MenuItem value={30}>30</MenuItem>
          <MenuItem value={40}>40</MenuItem>
          <MenuItem value={50}>50</MenuItem>
          <MenuItem value={60}>60</MenuItem>
          <MenuItem value={70}>70</MenuItem>
          <MenuItem value={80}>80</MenuItem>
        </Select>
      </Box>
    </Box>
  );
}
