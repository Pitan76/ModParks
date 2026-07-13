import { notFound } from "next/navigation";
import { getCollectionById } from "@/lib/actions/collection";
import { auth } from "@/lib/auth";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import ProjectCard from "@/components/project/ProjectCard";
import ListActions from "@/components/list/ListActions";
import FollowListButton from "@/components/list/FollowListButton";
import { setRequestLocale } from "next-intl/server";
import { getDatabase } from "@/lib/db";
import { collectionFollows } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

interface ListDetailPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function ListDetailPage({ params }: ListDetailPageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const [collection, session] = await Promise.all([
    getCollectionById(id),
    auth()
  ]);

  if (!collection) {
    notFound();
  }

  const isOwner = session?.user?.id === collection.userId;

  // visibility check
  if (!isOwner && collection.visibility === "private") {
    notFound();
  }

  const db = await getDatabase();
  const followersData = await db.select({ count: sql<number>`count(*)` }).from(collectionFollows).where(eq(collectionFollows.collectionId, collection.id)).get();
  const followersCount = followersData?.count || 0;

  let isFollowing = false;
  if (session?.user?.id && !isOwner) {
    const followRecord = await db.select().from(collectionFollows).where(and(eq(collectionFollows.userId, session.user.id), eq(collectionFollows.collectionId, collection.id))).get();
    if (followRecord) {
      isFollowing = true;
    }
  }

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Box sx={{ mb: 6 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
          {collection.iconUrl && (
            <Avatar src={collection.iconUrl} variant="rounded" sx={{ width: 64, height: 64, mr: 1, boxShadow: 1 }} />
          )}
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Typography variant="h3" sx={{ fontWeight: 800 }}>
                {collection.name}
              </Typography>
              <Chip 
                label={collection.visibility === "public" ? "公開" : collection.visibility === "unlisted" ? "限定公開" : "非公開"} 
                color={collection.visibility === "public" ? "primary" : "default"}
                size="small"
              />
            </Box>
            <Box sx={{ mt: 1 }}>
              <ListActions isOwner={isOwner} collection={collection} ownerUsername={collection.author?.username} />
            </Box>
            <Box sx={{ mt: 2 }}>
              {!isOwner ? (
                <FollowListButton 
                  collectionId={collection.id} 
                  initialIsFollowing={isFollowing} 
                  initialFollowersCount={followersCount}
                  isLoggedIn={!!session?.user} 
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  <Box component="span" sx={{ fontWeight: 800, color: "text.primary" }}>{followersCount}</Box> Followers
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
          <Typography variant="body2" color="text.secondary">Created by</Typography>
          <Box 
            component="a" 
            href={`/${locale}/profile/${collection.author?.username}`}
            sx={{ display: 'flex', alignItems: 'center', gap: 1, textDecoration: 'none', color: 'inherit', '&:hover': { textDecoration: 'underline' } }}
          >
            <Avatar src={collection.author?.avatarUrl || ""} sx={{ width: 24, height: 24 }} />
            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
              {collection.author?.displayName || collection.author?.username}
            </Typography>
          </Box>
        </Box>
        {collection.description && (
          <Typography variant="body1" sx={{ whiteSpace: "pre-wrap", color: "text.secondary" }}>
            {collection.description}
          </Typography>
        )}
      </Box>

      {collection.items.length > 0 ? (
        <Grid container spacing={3}>
          {collection.items.map(p => (
            <Grid key={p.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <ProjectCard project={p as any} layout="grid" />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Alert severity="info">
          このリストにはまだプロジェクトが追加されていません。
        </Alert>
      )}
    </Container>
  );
}
