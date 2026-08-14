"use client";

import { ReactNode } from "react";
import Box from "@mui/material/Box";
import PaginationControls from "./PaginationControls";

interface PaginatedContainerProps {
  totalCount: number;
  currentPage: number;
  currentLimit: number;
  children: ReactNode;
}

/**
 * 上下にページネーションコントロールを配置して、コンテンツを挟むコンポーネント。
 * コンテンツ件数が1ページの上限を超えている場合のみ、ページネーションを表示する。
 */
export default function PaginatedContainer({
  totalCount,
  currentPage,
  currentLimit,
  children,
}: PaginatedContainerProps) {
  const showPager = totalCount > currentLimit;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {showPager && (
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <PaginationControls
            totalCount={totalCount}
            currentPage={currentPage}
            currentLimit={currentLimit}
          />
        </Box>
      )}
      {children}
      {showPager && (
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <PaginationControls
            totalCount={totalCount}
            currentPage={currentPage}
            currentLimit={currentLimit}
          />
        </Box>
      )}
    </Box>
  );
}
