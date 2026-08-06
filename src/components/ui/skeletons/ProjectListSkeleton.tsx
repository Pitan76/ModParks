import Box from "@mui/material/Box";
import ProjectCardSkeleton from "@/components/ui/skeletons/ProjectCardSkeleton";

/**
 * プロジェクト一覧のロード中プレースホルダー。カードを縦に count 個並べる。
 */
export default function ProjectListSkeleton({ count = 6, layout = "list" }: { count?: number; layout?: "list" | "grid" }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {Array.from({ length: count }).map((_, i) => (
        <ProjectCardSkeleton key={i} layout={layout} />
      ))}
    </Box>
  );
}
