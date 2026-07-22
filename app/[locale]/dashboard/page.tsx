import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getDatabase } from "@/lib/db";
import { getUserProjectStats } from "@/lib/actions/projectQuery";
import { getFavoriteProjects } from "@/lib/actions/favorite";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import DownloadIcon from "@mui/icons-material/Download";
import FolderIcon from "@mui/icons-material/Folder";
import FavoriteIcon from "@mui/icons-material/Favorite";
import CommentIcon from "@mui/icons-material/Comment";
import AddIcon from "@mui/icons-material/Add";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import LinkButton from "@/components/ui/LinkButton";
import { projects, projectComments, users, userProfiles, ideas } from "@/db/schema";
import { eq, desc, count } from "drizzle-orm";
import Link from "next/link";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/${locale}/login`);
  }

  const t = await getTranslations("Dashboard");
  const tNav = await getTranslations("Nav");
  const tCommon = await getTranslations("Common");
  const db = await getDatabase();
  const userId = session.user.id;

  // Get user project stats
  const stats = await getUserProjectStats(userId);

  // Get favorites count
  const favorites = await getFavoriteProjects(userId);
  const topFavorites = favorites.slice(0, 5);
  
  // Get total comments count across all user's projects
  const [commentsCountResult] = await db.select({ value: count() })
    .from(projectComments)
    .innerJoin(projects, eq(projectComments.projectId, projects.id))
    .where(eq(projects.authorId, userId));
  const totalComments = commentsCountResult.value;

  // Get latest comments
  const latestComments = await db.select({
    id: projectComments.id,
    content: projectComments.content,
    createdAt: projectComments.createdAt,
    projectName: projects.name,
    projectSlug: projects.slug,
    authorName: userProfiles.displayName,
    authorUsername: userProfiles.username,
  })
    .from(projectComments)
    .innerJoin(projects, eq(projectComments.projectId, projects.id))
    .innerJoin(users, eq(projectComments.authorId, users.id))
    .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(eq(projects.authorId, userId))
    .orderBy(desc(projectComments.createdAt))
    .limit(5);

  // Get top 5 projects for the table
  const recentProjects = await db.select()
    .from(projects)
    .where(eq(projects.authorId, userId))
    .orderBy(desc(projects.updatedAt))
    .limit(5);

  // Get top 5 ideas for the table
  const myIdeas = await db.select()
    .from(ideas)
    .where(eq(ideas.authorId, userId))
    .orderBy(desc(ideas.createdAt))
    .limit(5);

  const StatCard = ({ title, value, icon, gradient }: { title: string, value: number, icon: React.ReactNode, gradient: string }) => (
    <Card sx={{ 
      height: "100%", 
      background: gradient,
      color: "white",
      borderRadius: 3,
      border: "none"
    }}>
      <CardContent sx={{ position: "relative", overflow: "hidden", p: { xs: 2, sm: 3 }, height: "100%" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: { xs: 1, sm: 2 }, position: "relative", zIndex: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: "uppercase", opacity: 0.9, letterSpacing: 0.5, fontSize: { xs: "0.7rem", sm: "0.875rem" }, lineHeight: 1.3 }}>
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
            textOverflow: "ellipsis"
          }}
        >
          {value.toLocaleString()}
        </Typography>
        <Box sx={{ 
          position: "absolute", 
          right: -10, 
          bottom: -15, 
          opacity: 0.15, 
          transform: "scale(3)", 
          zIndex: 0 
        }}>
          {icon}
        </Box>
      </CardContent>
    </Card>
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "public": return "success";
      case "unlisted": return "warning";
      case "private": return "default";
      case "draft": return "default";
      default: return "default";
    }
  };

  const getIdeaStatusColor = (status: string) => {
    switch (status) {
      case "open": return "success";
      case "in_progress": return "warning";
      case "completed": return "info";
      case "archived": return "default";
      case "draft": return "default";
      default: return "default";
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 6 }, px: { xs: 2, sm: 3 } }}>
      <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" }, mb: 4, gap: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 900, fontSize: { xs: "1.75rem", sm: "2.125rem" } }}>
          {t("title")}
        </Typography>
        <Box sx={{ display: "flex", gap: { xs: 1, sm: 2 }, flexWrap: "wrap" }}>
          <LinkButton href="/ideas/new" variant="outlined" color="primary" startIcon={<AddIcon />} sx={{ flex: { xs: 1, sm: "none" }, borderRadius: 2, px: { xs: 2, sm: 3 }, fontWeight: "bold", textTransform: "none", whiteSpace: "nowrap" }}>
            {t("newIdea")}
          </LinkButton>
          <LinkButton href="/projects/new" variant="contained" color="primary" startIcon={<AddIcon />} sx={{ flex: { xs: 1, sm: "none" }, borderRadius: 2, px: { xs: 2, sm: 3 }, fontWeight: "bold", textTransform: "none", whiteSpace: "nowrap" }}>
            {tNav("newProject")}
          </LinkButton>
        </Box>
      </Box>

      {/* Stats Grid */}
      <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ mb: { xs: 4, md: 6 } }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard 
            title={t("stats.projects")} 
            value={stats.totalProjects} 
            icon={<FolderIcon />} 
            gradient="linear-gradient(135deg, #1976d2 0%, #0d47a1 100%)" 
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard 
            title={t("stats.downloads")} 
            value={stats.totalDownloads} 
            icon={<DownloadIcon />} 
            gradient="linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)" 
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard 
            title={t("stats.favorites")} 
            value={favorites.length} 
            icon={<FavoriteIcon />} 
            gradient="linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)" 
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard 
            title={t("stats.comments")} 
            value={totalComments}
            icon={<CommentIcon />} 
            gradient="linear-gradient(135deg, #ed6c02 0%, #e65100 100%)" 
          />
        </Grid>
      </Grid>

      {/* 2-Column Layout */}
      <Grid container spacing={{ xs: 3, md: 4 }}>
        {/* Main Content (Left) */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Stack spacing={{ xs: 4, md: 6 }}>
            
            {/* My Projects */}
            <Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, fontSize: { xs: "1.25rem", sm: "1.5rem" }, display: "flex", alignItems: "center", minWidth: 0 }}>
                  <FolderIcon sx={{ verticalAlign: "middle", mr: 1 }} />
                  {tNav("myProjects")}
                </Typography>
                <LinkButton href="/projects/manage" variant="text" endIcon={<ChevronRightIcon />} sx={{ fontWeight: "bold" }}>
                  {t("viewAll")}
                </LinkButton>
              </Box>
              <Card sx={{ borderRadius: 3 }}>
                <TableContainer>
                  <Table sx={{ minWidth: 480 }}>
                    <TableHead sx={{ bgcolor: "action.hover" }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: "bold" }}>{t("table.projectName")}</TableCell>
                        <TableCell sx={{ fontWeight: "bold" }}>{t("table.status")}</TableCell>
                        <TableCell sx={{ fontWeight: "bold", textAlign: "right" }}>{t("table.downloads")}</TableCell>
                        <TableCell sx={{ fontWeight: "bold", textAlign: "right" }}>{t("table.updated")}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentProjects.length > 0 ? recentProjects.map(p => (
                        <TableRow key={p.id} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                          <TableCell>
                            <Link href={`/projects/${p.slug}`} style={{ fontWeight: "bold", textDecoration: "none", color: "inherit" }}>
                              {p.name}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Chip label={tCommon(`visibility.${p.status}`)} size="small" color={getStatusColor(p.status) as any} />
                          </TableCell>
                          <TableCell align="right">
                            {p.totalDownloads.toLocaleString()}
                          </TableCell>
                          <TableCell align="right" sx={{ color: "text.secondary" }}>
                            {new Date(p.updatedAt || p.createdAt || 0).toLocaleDateString(locale)}
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={4} align="center" sx={{ py: 4, color: "text.secondary" }}>
                            {t("noProjects")}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Card>
            </Box>

            {/* My Ideas */}
            <Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, fontSize: { xs: "1.25rem", sm: "1.5rem" }, display: "flex", alignItems: "center", minWidth: 0 }}>
                  <LightbulbIcon sx={{ verticalAlign: "middle", mr: 1 }} />
                  {t("myIdeas")}
                </Typography>
                <LinkButton href="/ideas?author=me" variant="text" endIcon={<ChevronRightIcon />} sx={{ fontWeight: "bold" }}>
                  {t("viewAll")}
                </LinkButton>
              </Box>
              <Card sx={{ borderRadius: 3 }}>
                <TableContainer>
                  <Table sx={{ minWidth: 420 }}>
                    <TableHead sx={{ bgcolor: "action.hover" }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: "bold" }}>{t("table.ideaTitle")}</TableCell>
                        <TableCell sx={{ fontWeight: "bold" }}>{t("table.status")}</TableCell>
                        <TableCell sx={{ fontWeight: "bold", textAlign: "right" }}>{t("table.created")}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {myIdeas.length > 0 ? myIdeas.map(idea => (
                        <TableRow key={idea.id} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                          <TableCell>
                            <Link href={`/ideas/${idea.id}`} style={{ fontWeight: "bold", textDecoration: "none", color: "inherit" }}>
                              {idea.title}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Chip label={idea.status.replace("_", " ")} size="small" color={getIdeaStatusColor(idea.status) as any} sx={{ textTransform: "capitalize" }} />
                          </TableCell>
                          <TableCell align="right" sx={{ color: "text.secondary" }}>
                            {new Date(idea.createdAt).toLocaleDateString(locale)}
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={3} align="center" sx={{ py: 4, color: "text.secondary" }}>
                            {t("noIdeas")}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Card>
            </Box>
            
          </Stack>
        </Grid>

        {/* Sidebar Content (Right) */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={{ xs: 4, md: 6 }}>
            {/* Recent Comments */}
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
                <CommentIcon sx={{ verticalAlign: "middle", mr: 1 }} />
                {t("recentComments")}
              </Typography>
              <Card sx={{ borderRadius: 3 }}>
                <CardContent sx={{ p: 0 }}>
                  {latestComments.length > 0 ? latestComments.map(c => (
                    <Box key={c.id} sx={{ 
                      p: 3, 
                      borderBottom: "1px solid", 
                      borderColor: "divider", 
                      "&:last-child": { borderBottom: "none" } 
                    }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {c.authorName || c.authorUsername}
                        </Typography>
                        <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: "nowrap", ml: 2 }}>
                          {new Date(c.createdAt || 0).toLocaleDateString(locale)}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: "0.8rem" }}>
                        {t("commentOn")} <Link href={`/projects/${c.projectSlug}`} style={{ color: "inherit", textDecoration: "underline" }}>{c.projectName}</Link>
                      </Typography>
                      <Typography variant="body1" sx={{ wordBreak: "break-word", lineHeight: 1.6 }}>
                        {c.content}
                      </Typography>
                    </Box>
                  )) : (
                    <Box sx={{ py: 4, textAlign: "center" }}>
                      <Typography color="text.secondary">{t("noComments")}</Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Box>

            {/* Recent Favorites */}
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
                <FavoriteIcon sx={{ verticalAlign: "middle", mr: 1 }} />
                {t("recentFavorites")}
              </Typography>
              <Card sx={{ borderRadius: 3 }}>
                <CardContent sx={{ p: 0 }}>
                  {topFavorites.length > 0 ? topFavorites.map(fav => (
                    <Box key={fav.id} sx={{ 
                      p: 2, 
                      borderBottom: "1px solid", 
                      borderColor: "divider", 
                      "&:last-child": { borderBottom: "none" },
                      display: "flex",
                      alignItems: "center",
                      gap: 2
                    }}>
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
                  )) : (
                    <Box sx={{ py: 4, textAlign: "center" }}>
                      <Typography color="text.secondary">{t("noFavorites")}</Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Box>
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}
