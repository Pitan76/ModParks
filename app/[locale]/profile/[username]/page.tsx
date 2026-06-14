import { notFound, redirect } from "next/navigation";
import { getDb, getD1 } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import GitHubIcon from "@mui/icons-material/GitHub";
import Link from "@mui/material/Link";
import Grid from "@mui/material/Grid";
import ProjectCard from "@/components/project/ProjectCard";
import { getProjects } from "@/lib/actions/project";
import { getFavoriteProjects } from "@/lib/actions/favorite";
import { setRequestLocale } from "next-intl/server";
import Alert from "@mui/material/Alert";

interface PublicProfileProps {
  params: Promise<{ locale: string; username: string }>;
}

export default async function PublicProfilePage({ params }: PublicProfileProps) {
  const { locale, username } = await params;
  setRequestLocale(locale);

  const d1 = await getD1();
  const db = getDb(d1);

  let user = await db.select().from(users).where(eq(users.username, username)).get();

  // If not found, check previousUsername
  if (!user) {
    const prevUser = await db.select().from(users).where(eq(users.previousUsername, username)).get();
    if (prevUser && prevUser.username) {
      redirect(`/${locale}/profile/${prevUser.username}`);
    }
    notFound();
  }

  // Soft deleted user check
  if (user.deletedAt) {
    return (
      <Container maxWidth="md" sx={{ py: 10, textAlign: "center" }}>
        <Typography variant="h5" color="text.secondary">
          このアカウントは削除されました
        </Typography>
      </Container>
    );
  }

  // Fetch user projects and favorites
  const [allProjects, favoritedProjects] = await Promise.all([
    getProjects({ authorId: user.id }),
    getFavoriteProjects(user.id)
  ]);
  const publishedProjects = allProjects.filter(p => p.status === "published");

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 3, mb: 6 }}>
        <Avatar src={user.avatarUrl || ""} sx={{ width: 100, height: 100 }} />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            {user.displayName || user.username}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
            @{user.username}
          </Typography>
          
          {user.bio && (
            <Typography variant="body1" sx={{ mt: 1, whiteSpace: "pre-wrap" }}>
              {user.bio}
            </Typography>
          )}

          {user.githubUsername && (
            <Box sx={{ mt: 1 }}>
              <Link
                href={`https://github.com/${user.githubUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: "text.primary" }}
              >
                <GitHubIcon fontSize="small" />
                {user.githubUsername}
              </Link>
            </Box>
          )}
        </Box>
      </Box>

      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
        Projects
      </Typography>
      
      {publishedProjects.length > 0 ? (
        <Grid container spacing={2}>
          {publishedProjects.map(p => (
            <Grid key={p.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <ProjectCard project={p as any} layout="grid" />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Alert severity="info" sx={{ mt: 2 }}>
          まだ公開されているプロジェクトはありません。
        </Alert>
      )}

      <Typography variant="h5" sx={{ fontWeight: 700, mt: 6, mb: 3 }}>
        Favorites
      </Typography>
      
      {favoritedProjects.length > 0 ? (
        <Grid container spacing={2}>
          {favoritedProjects.map(p => (
            <Grid key={p.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <ProjectCard project={p as any} layout="grid" />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Alert severity="info" sx={{ mt: 2 }}>
          まだお気に入りに登録したプロジェクトはありません。
        </Alert>
      )}
    </Container>
  );
}
