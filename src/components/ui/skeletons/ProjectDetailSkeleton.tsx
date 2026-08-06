import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";

/**
 * プロジェクト詳細ページのロード中プレースホルダー。
 * 左カラム（ヘッダー + タブ本文）と右カラム（サイドバー）の2カラム構成に合わせる。
 */
export default function ProjectDetailSkeleton() {
  return (
    <Grid container spacing={4}>
      <Grid size={{ xs: 12, md: 8 }} sx={{ minWidth: 0, maxWidth: "100%" }}>
        {/* ヘッダー: アイコン + タイトル + アクション */}
        <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", mb: 3 }}>
          <Skeleton variant="rounded" width={80} height={80} sx={{ flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Skeleton variant="text" width="50%" sx={{ fontSize: "2rem" }} />
            <Skeleton variant="text" width="80%" />
            <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
              <Skeleton variant="rounded" width={100} height={36} />
              <Skeleton variant="rounded" width={100} height={36} />
            </Box>
          </Box>
        </Box>

        {/* タブ */}
        <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
          <Skeleton variant="text" width={80} />
          <Skeleton variant="text" width={80} />
          <Skeleton variant="text" width={80} />
        </Box>

        {/* 本文 */}
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="95%" />
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="rounded" width="100%" height={160} sx={{ mt: 2 }} />
      </Grid>

      <Grid size={{ xs: 12, md: 4 }}>
        <Skeleton variant="rounded" width="100%" height={280} />
      </Grid>
    </Grid>
  );
}
