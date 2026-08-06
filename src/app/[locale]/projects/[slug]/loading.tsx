import Container from "@mui/material/Container";
import ProjectDetailSkeleton from "@/components/ui/skeletons/ProjectDetailSkeleton";

export default function Loading() {
  return (
    <Container maxWidth="lg" sx={{ py: 5 }}>
      <ProjectDetailSkeleton />
    </Container>
  );
}
