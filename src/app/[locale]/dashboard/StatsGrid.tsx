import { getTranslations } from "next-intl/server";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import DownloadIcon from "@mui/icons-material/Download";
import FolderIcon from "@mui/icons-material/Folder";
import FavoriteIcon from "@mui/icons-material/Favorite";
import CommentIcon from "@mui/icons-material/Comment";

function StatCard({
  title,
  value,
  icon,
  gradient,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  gradient: string;
}) {
  return (
    <Card sx={{ height: "100%", background: gradient, color: "white", borderRadius: 3, border: "none" }}>
      <CardContent sx={{ position: "relative", overflow: "hidden", p: { xs: 2, sm: 3 }, height: "100%" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: { xs: 1, sm: 2 },
            position: "relative",
            zIndex: 1,
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 700,
              textTransform: "uppercase",
              opacity: 0.9,
              letterSpacing: 0.5,
              fontSize: { xs: "0.7rem", sm: "0.875rem" },
              lineHeight: 1.3,
            }}
          >
            {title}
          </Typography>
        </Box>
        <Typography
          variant="h3"
          sx={{
            fontWeight: 800,
            position: "relative",
            zIndex: 1,
            fontSize: { xs: "1.5rem", sm: "1.75rem", md: "2rem", lg: "2.5rem", xl: "3rem" },
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {value.toLocaleString()}
        </Typography>
        <Box sx={{ position: "absolute", right: -10, bottom: -15, opacity: 0.15, transform: "scale(3)", zIndex: 0 }}>
          {icon}
        </Box>
      </CardContent>
    </Card>
  );
}

type Props = {
  totalProjects: number;
  totalDownloads: number;
  favorites: number;
  comments: number;
};

export default async function StatsGrid({ totalProjects, totalDownloads, favorites, comments }: Props) {
  const t = await getTranslations("Dashboard");
  const cards = [
    { title: t("stats.projects"), value: totalProjects, icon: <FolderIcon />, gradient: "linear-gradient(135deg, #1976d2 0%, #0d47a1 100%)" },
    { title: t("stats.downloads"), value: totalDownloads, icon: <DownloadIcon />, gradient: "linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)" },
    { title: t("stats.favorites"), value: favorites, icon: <FavoriteIcon />, gradient: "linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)" },
    { title: t("stats.comments"), value: comments, icon: <CommentIcon />, gradient: "linear-gradient(135deg, #ed6c02 0%, #e65100 100%)" },
  ];

  return (
    <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ mb: { xs: 4, md: 6 } }}>
      {cards.map((c) => (
        <Grid key={c.title} size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard {...c} />
        </Grid>
      ))}
    </Grid>
  );
}
