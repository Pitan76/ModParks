import Container from "@mui/material/Container";
import ProfileSkeleton from "@/components/ui/skeletons/ProfileSkeleton";

export default function Loading() {
  return (
    <Container maxWidth="lg" sx={{ py: 5 }}>
      <ProfileSkeleton />
    </Container>
  );
}
