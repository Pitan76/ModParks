import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";

/**
 * ProjectCard のロード中プレースホルダー。
 * 実カードのレイアウト（アイコン + 主情報 + メタ）に形を合わせている。
 */
export default function ProjectCardSkeleton({ layout = "list" }: { layout?: "list" | "grid" }) {
  const isGrid = layout === "grid";

  return (
    <Card style={{ boxShadow: "none" }} sx={{ height: "100%" }}>
      <CardContent
        sx={{
          p: 2,
          display: "flex",
          flexDirection: isGrid ? "column" : { xs: "column", sm: "row" },
          alignItems: isGrid ? "stretch" : { xs: "stretch", sm: "center" },
          gap: 2,
          height: "100%",
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "row", gap: 2, alignItems: "flex-start", flex: isGrid ? "none" : { xs: "none", sm: 1 }, minWidth: 0 }}>
          <Skeleton variant="rounded" width={48} height={48} sx={{ flexShrink: 0 }} />

          <Box sx={{ flex: 1, minWidth: 120, display: "flex", flexDirection: "column", gap: 0.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Skeleton variant="text" width="45%" sx={{ fontSize: "1rem" }} />
              <Skeleton variant="rounded" width={40} height={20} />
            </Box>
            <Skeleton variant="text" width="90%" />
            <Skeleton variant="text" width="35%" sx={{ fontSize: "0.75rem" }} />
          </Box>
        </Box>

        <Box
          sx={{
            display: "flex",
            flexDirection: isGrid ? "row" : { xs: "row", sm: "column" },
            alignItems: isGrid ? "center" : { xs: "center", sm: "flex-end" },
            gap: isGrid ? 2 : { xs: 2, sm: 1 },
            flexShrink: 0,
            mt: isGrid ? "auto" : { xs: "auto", sm: 0 },
          }}
        >
          <Skeleton variant="text" width={64} />
          <Box sx={{ display: "flex", gap: 0.5 }}>
            <Skeleton variant="rounded" width={40} height={18} />
            <Skeleton variant="rounded" width={40} height={18} />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
