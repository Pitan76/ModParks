import Skeleton from "@mui/material/Skeleton";
import TableSkeleton from "@/components/ui/skeletons/TableSkeleton";

export default function Loading() {
  return (
    <>
      <Skeleton variant="text" width={240} sx={{ fontSize: "2rem", mb: 4 }} />
      <TableSkeleton rows={8} />
    </>
  );
}
