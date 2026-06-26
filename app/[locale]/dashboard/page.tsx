import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getDatabase } from "@/lib/db";
import { getUserProjectStats } from "@/lib/actions/project";
import { getFavoriteProjects } from "@/lib/actions/favorite";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import DownloadIcon from "@mui/icons-material/Download";
import FolderIcon from "@mui/icons-material/Folder";
import FavoriteIcon from "@mui/icons-material/Favorite";
import CommentIcon from "@mui/icons-material/Comment";
import ProjectCard from "@/components/project/ProjectCard";
import { projects, projectComments, users, userProfiles } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/${locale}/login`);
  }

  const t = await getTranslations("Dashboard");
  const db = await getDatabase();
  const userId = session.user.id;

  // Get user project stats
  const stats = await getUserProjectStats(userId);

  // Get favorites count
  const favorites = await getFavoriteProjects(userId);
  
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

  // Get current user profile
  const profileList = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  const profile = profileList[0];

  // Get top 3 projects
  const rawTopProjects = await db.select()
    .from(projects)
    .where(eq(projects.authorId, userId))
    .orderBy(desc(projects.totalDownloads))
    .limit(3);

  const topProjects = rawTopProjects.map(p => ({
    ...p,
    authorUsername: profile?.username,
    authorDisplayName: profile?.displayName,
    authorAvatarUrl: profile?.avatarUrl,
  }));

  const StatCard = ({ title, value, icon, color }: { title: string, value: number, icon: React.ReactNode, color: string }) => (
    <Card sx={{ height: "100%", borderTop: `4px solid ${color}` }}>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
          <Typography color="text.secondary" variant="subtitle2" sx={{ fontWeight: "bold", textTransform: "uppercase" }}>
            {title}
          </Typography>
          <Box sx={{ color, opacity: 0.8 }}>
            {icon}
          </Box>
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          {value.toLocaleString()}
        </Typography>
      </CardContent>
    </Card>
  );

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: 800 }}>
        {t("title")}
      </Typography>

      <Grid container spacing={3} sx={{ mb: 6 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard 
            title={t("stats.projects")} 
            value={stats.totalProjects} 
            icon={<FolderIcon fontSize="large" />} 
            color="#2196f3" 
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard 
            title={t("stats.downloads")} 
            value={stats.totalDownloads} 
            icon={<DownloadIcon fontSize="large" />} 
            color="#4caf50" 
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard 
            title={t("stats.favorites")} 
            value={favorites.length} 
            icon={<FavoriteIcon fontSize="large" />} 
            color="#f44336" 
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard 
            title={t("stats.comments")} 
            value={latestComments.length} // Actually just recent count shown, but we can do a sum if we want.
            icon={<CommentIcon fontSize="large" />} 
            color="#ff9800" 
          />
        </Grid>
      </Grid>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Typography variant="h5" sx={{ mb: 3, fontWeight: "bold" }}>
            {t("topProjects")}
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {topProjects.length > 0 ? topProjects.map(p => (
              <ProjectCard 
                key={p.id}
                project={{
                  ...p,
                  type: p.type as any,
                  tags: [],
                  externalDownloads: p.externalDownloads as Record<string, number>
                }}
              />
            )) : (
              <Typography color="text.secondary">{t("noProjects")}</Typography>
            )}
          </Box>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Typography variant="h5" sx={{ mb: 3, fontWeight: "bold" }}>
            {t("recentComments")}
          </Typography>
          <Card>
            <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {latestComments.length > 0 ? latestComments.map(c => (
                <Box key={c.id} sx={{ pb: 2, borderBottom: "1px solid", borderColor: "divider", "&:last-child": { borderBottom: "none", pb: 0 } }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    <strong>{c.authorName || c.authorUsername}</strong> on <strong>{c.projectName}</strong>
                  </Typography>
                  <Typography variant="body1" sx={{ wordBreak: "break-word" }}>
                    {c.content}
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    {new Date(c.createdAt || 0).toLocaleString()}
                  </Typography>
                </Box>
              )) : (
                <Typography color="text.secondary">{t("noComments")}</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}
