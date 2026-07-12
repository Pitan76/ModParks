import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import ProjectListSkeleton from "@/components/ui/skeletons/ProjectListSkeleton";

export default function Loading() {
  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 6 }}>
        <Skeleton variant="rounded" width={64} height={64} sx={{ flexShrink: 0 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Skeleton variant="text" width="40%" sx={{ fontSize: "2.5rem" }} />
          <Skeleton variant="text" width={120} />
        </Box>
      </Box>
      <ProjectListSkeleton count={4} />
    </Container>
  );
}
