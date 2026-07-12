import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Skeleton from "@mui/material/Skeleton";

/**
 * アイデアカード1枚分のプレースホルダー。
 */
function IdeaCardSkeleton() {
  return (
    <Card variant="outlined">
      <Box sx={{ p: 3 }}>
        <Skeleton variant="text" width="55%" sx={{ fontSize: "1.25rem" }} />
        <Skeleton variant="text" width="100%" sx={{ mt: 0.5 }} />
        <Skeleton variant="text" width="80%" sx={{ mb: 2 }} />
        <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
          <Skeleton variant="text" width={40} />
          <Skeleton variant="text" width={40} />
          <Skeleton variant="rounded" width={72} height={24} />
        </Box>
      </Box>
    </Card>
  );
}

/**
 * アイデア一覧のロード中プレースホルダー。
 */
export default function IdeaListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {Array.from({ length: count }).map((_, i) => (
        <IdeaCardSkeleton key={i} />
      ))}
    </Box>
  );
}
