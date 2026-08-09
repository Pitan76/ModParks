import { getTranslations } from "next-intl/server";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ProjectCard from "@/components/project/ProjectCard";
import type { ProjectCardProps } from "@/components/project/ProjectCard";

type ResolvedProjectItem = ProjectCardProps["project"] & {
  versionNumber: string | null;
};

export default async function ResolvedProjects({ projects }: { projects: ResolvedProjectItem[] }) {
  if (projects.length === 0) return null;
  const tIdea = await getTranslations("Idea");

  return (
    <Box sx={{ mb: 6 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
        <CheckCircleIcon color="success" />
        {tIdea("resolvedBy")}
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {projects.map((p) => (
          <Box key={p.id} sx={{ position: "relative" }}>
            {p.versionNumber && (
              <Box
                sx={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  zIndex: 2,
                  bgcolor: "success.light",
                  color: "success.contrastText",
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  fontSize: "0.75rem",
                  fontWeight: "bold",
                  pointerEvents: "none",
                }}
              >
                v{p.versionNumber}
              </Box>
            )}
            <ProjectCard project={p} layout="list" showCart={false} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

