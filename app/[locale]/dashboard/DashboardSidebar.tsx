import { getTranslations } from "next-intl/server";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import CommentIcon from "@mui/icons-material/Comment";
import FavoriteIcon from "@mui/icons-material/Favorite";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Link from "next/link";
import type { DashboardData } from "./dashboardData";

type Props = {
  locale: string;
  latestComments: DashboardData["latestComments"];
  topFavorites: DashboardData["topFavorites"];
};

export default async function DashboardSidebar({ locale, latestComments, topFavorites }: Props) {
  const t = await getTranslations("Dashboard");

  return (
    <Grid size={{ xs: 12, lg: 4 }}>
      <Stack spacing={{ xs: 4, md: 6 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
            <CommentIcon sx={{ verticalAlign: "middle", mr: 1 }} />
            {t("recentComments")}
          </Typography>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 0 }}>
              {latestComments.length > 0 ? (
                latestComments.map((c) => (
                  <Box
                    key={c.id}
                    sx={{ p: 3, borderBottom: "1px solid", borderColor: "divider", "&:last-child": { borderBottom: "none" } }}
                  >
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {c.authorName || c.authorUsername}
                      </Typography>
                      <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: "nowrap", ml: 2 }}>
                        {new Date(c.createdAt || 0).toLocaleDateString(locale)}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: "0.8rem" }}>
                      {t("commentOn")}{" "}
                      <Link href={`/projects/${c.projectSlug}`} style={{ color: "inherit", textDecoration: "underline" }}>
                        {c.projectName}
                      </Link>
                    </Typography>
                    <Typography variant="body1" sx={{ wordBreak: "break-word", lineHeight: 1.6 }}>
                      {c.content}
                    </Typography>
                  </Box>
                ))
              ) : (
                <Box sx={{ py: 4, textAlign: "center" }}>
                  <Typography color="text.secondary">{t("noComments")}</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>

        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
            <FavoriteIcon sx={{ verticalAlign: "middle", mr: 1 }} />
            {t("recentFavorites")}
          </Typography>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 0 }}>
              {topFavorites.length > 0 ? (
                topFavorites.map((fav) => (
                  <Box
                    key={fav.id}
                    sx={{
                      p: 2,
                      borderBottom: "1px solid",
                      borderColor: "divider",
                      "&:last-child": { borderBottom: "none" },
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/projects/${fav.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
                        <Typography variant="subtitle2" noWrap sx={{ fontWeight: "bold" }}>
                          {fav.name}
                        </Typography>
                      </Link>
                      <Typography variant="caption" color="text.secondary">
                        {t("favoritedOn", { date: new Date(fav.favoritedAt || 0).toLocaleDateString(locale) })}
                      </Typography>
                    </Box>
                    <ChevronRightIcon color="action" fontSize="small" />
                  </Box>
                ))
              ) : (
                <Box sx={{ py: 4, textAlign: "center" }}>
                  <Typography color="text.secondary">{t("noFavorites")}</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      </Stack>
    </Grid>
  );
}
