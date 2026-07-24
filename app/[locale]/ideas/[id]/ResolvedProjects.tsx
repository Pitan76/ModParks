import { getTranslations } from "next-intl/server";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LinkButton from "@/components/ui/LinkButton";
import type { IdeaDetail } from "./ideaDetailData";

export default async function ResolvedProjects({ projects }: { projects: IdeaDetail["resolvedProjects"] }) {
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
          <Card key={p.projectId} variant="outlined" sx={{ borderRadius: 2, bgcolor: "success.50", borderColor: "success.main" }}>
            <CardContent
              sx={{
                py: 2,
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                justifyContent: "space-between",
                alignItems: { xs: "stretch", sm: "center" },
                gap: 2,
                "&:last-child": { pb: 2 },
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body1" sx={{ fontWeight: 600, color: "success.dark", wordBreak: "break-word" }}>
                  {p.projectName} {p.versionNumber ? `(v${p.versionNumber})` : ""}
                </Typography>
                {p.projectDescription && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {p.projectDescription}
                  </Typography>
                )}
              </Box>
              <LinkButton variant="outlined" size="small" href={`/projects/${p.projectSlug}`} sx={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                {tIdea("viewProject")}
              </LinkButton>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
}
