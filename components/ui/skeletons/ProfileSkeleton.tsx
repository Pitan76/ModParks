import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import ProjectListSkeleton from "@/components/ui/skeletons/ProjectListSkeleton";

/**
 * プロフィールページのロード中プレースホルダー。
 * ヘッダー（アバター + 表示名 + 自己紹介）と投稿プロジェクト一覧に形を合わせる。
 */
export default function ProfileSkeleton() {
  return (
    <Box>
      <Box sx={{ display: "flex", gap: 3, alignItems: "center", mb: 4 }}>
        <Skeleton variant="circular" width={96} height={96} sx={{ flexShrink: 0 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Skeleton variant="text" width="40%" sx={{ fontSize: "1.75rem" }} />
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="30%" />
        </Box>
      </Box>

      <Skeleton variant="text" width={160} sx={{ fontSize: "1.25rem", mb: 2 }} />
      <ProjectListSkeleton count={4} />
    </Box>
  );
}
