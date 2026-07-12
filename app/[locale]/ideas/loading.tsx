import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import IdeaListSkeleton from "@/components/ui/skeletons/IdeaListSkeleton";

export default function Loading() {
  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
        <Box>
          <Skeleton variant="text" width={200} sx={{ fontSize: "2rem" }} />
          <Skeleton variant="text" width={320} />
        </Box>
        <Skeleton variant="rounded" width={140} height={40} sx={{ flexShrink: 0 }} />
      </Box>
      <IdeaListSkeleton count={5} />
    </Container>
  );
}
