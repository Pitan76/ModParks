import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";

/**
 * 管理画面などのテーブル/リストのロード中プレースホルダー。
 * ヘッダー行 + 行を rows 個並べる。
 */
export default function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, overflow: "hidden" }}>
      <Box sx={{ display: "flex", gap: 2, p: 2, bgcolor: "action.hover" }}>
        <Skeleton variant="text" width="30%" />
        <Skeleton variant="text" width="25%" />
        <Skeleton variant="text" width="20%" />
      </Box>
      {Array.from({ length: rows }).map((_, i) => (
        <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 2, p: 2, borderTop: "1px solid", borderColor: "divider" }}>
          <Skeleton variant="text" width="30%" />
          <Skeleton variant="text" width="25%" />
          <Skeleton variant="text" width="20%" />
          <Skeleton variant="rounded" width={72} height={30} sx={{ ml: "auto" }} />
        </Box>
      ))}
    </Box>
  );
}
