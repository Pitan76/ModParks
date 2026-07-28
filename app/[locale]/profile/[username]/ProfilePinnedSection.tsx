import { getTranslations } from "next-intl/server";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import PushPinIcon from "@mui/icons-material/PushPin";
import ProjectCard from "@/components/project/ProjectCard";
import IdeaCard from "@/components/idea/IdeaCard";
import type { PinnedItem } from "./profileData";

/** プロフィール上部のピン留め一覧。プロジェクトとアイデアを混在表示する。 */
export default async function ProfilePinnedSection({ items }: { items: PinnedItem[] }) {
  if (items.length === 0) return null;

  const t = await getTranslations("Profile");

  return (
    <Box sx={{ mb: { xs: 4, md: 6 } }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, display: "flex", alignItems: "center", gap: 1, fontSize: { xs: "1.3rem", sm: "1.5rem" } }}>
        <PushPinIcon fontSize="small" color="action" />
        {t("pinned")}
      </Typography>
      <Grid container spacing={2}>
        {items.map((item) =>
          item.kind === "project" ? (
            <Grid key={`project-${(item.project as any).id}`} size={{ xs: 12, sm: 6, md: 4 }}>
              <ProjectCard project={item.project} layout="grid" />
            </Grid>
          ) : (
            <Grid key={`idea-${item.idea.id}`} size={{ xs: 12, sm: 6, md: 4 }}>
              <IdeaCard idea={item.idea} />
            </Grid>
          )
        )}
      </Grid>
    </Box>
  );
}
