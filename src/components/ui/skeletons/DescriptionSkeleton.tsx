import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";

/**
 * 説明文（Markdown/PukiWiki）のクライアント描画待ちプレースホルダー。
 * パースが重く初回描画までブランクになるため、段落状のスケルトンで
 * 「読み込み中」を明示する。
 */
export default function DescriptionSkeleton() {
  return (
    <Box sx={{ p: 2 }}>
      <Skeleton variant="text" width="45%" sx={{ fontSize: "1.5rem", mb: 1.5 }} />
      <Skeleton variant="text" width="100%" />
      <Skeleton variant="text" width="95%" />
      <Skeleton variant="text" width="88%" />
      <Skeleton variant="text" width="60%" sx={{ mb: 2 }} />
      <Skeleton variant="rectangular" width="100%" height={120} sx={{ borderRadius: 1 }} />
    </Box>
  );
}
