import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";
import ProjectListSkeleton from "@/components/ui/skeletons/ProjectListSkeleton";

export default function Loading() {
  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Skeleton variant="text" width={240} sx={{ fontSize: "2rem", mb: 4 }} />

      {/* 統計カード */}
      <Grid container spacing={3} sx={{ mb: 6 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
            <Skeleton variant="rounded" width="100%" height={120} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Skeleton variant="text" width={180} sx={{ fontSize: "1.5rem", mb: 3 }} />
          <ProjectListSkeleton count={3} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Skeleton variant="text" width={180} sx={{ fontSize: "1.5rem", mb: 3 }} />
          <Skeleton variant="rounded" width="100%" height={240} />
        </Grid>
      </Grid>
    </Container>
  );
}
