import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import ProjectListSkeleton from "@/components/ui/skeletons/ProjectListSkeleton";

export default function Loading() {
  return (
    <Container maxWidth="lg" sx={{ py: 5 }}>
      <Box sx={{ mb: 4 }}>
        <Skeleton variant="text" width={240} sx={{ fontSize: "2rem" }} />
        <Skeleton variant="text" width={360} />
      </Box>
      <Skeleton variant="rounded" width="100%" height={56} sx={{ mb: 3 }} />
      <ProjectListSkeleton count={6} />
    </Container>
  );
}
