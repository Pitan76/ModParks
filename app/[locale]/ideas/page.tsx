import { getTranslations } from "next-intl/server";
import { setRequestLocale } from "next-intl/server";
import { getDatabase } from "@/lib/db";
import { ideas, users, userProfiles, ideaLikes, ideaComments } from "@/db/schema";
import { eq, sql, desc, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";

import Chip from "@mui/material/Chip";
import FavoriteIcon from "@mui/icons-material/Favorite";
import CommentIcon from "@mui/icons-material/Comment";
import AddIcon from "@mui/icons-material/Add";
import LinkCardActionArea from "@/components/ui/LinkCardActionArea";
import LinkButton from "@/components/ui/LinkButton";
import { formatDate } from "@/lib/utils/format";

export default async function IdeasPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");
  const tIdea = await getTranslations("Idea");

  const db = await getDatabase();
  const session = await auth();

  // Fetch ideas with author, like count, and comment count
  const allIdeas = await db
    .select({
      id: ideas.id,
      title: ideas.title,
      content: ideas.content,
      status: ideas.status,
      createdAt: ideas.createdAt,
      authorId: users.id,
      authorName: userProfiles.displayName,
      authorAvatar: userProfiles.avatarUrl,
      likesCount: sql<number>`(SELECT count(*) FROM ${ideaLikes} WHERE ${ideaLikes.ideaId} = ${ideas.id})`,
      commentsCount: sql<number>`(SELECT count(*) FROM ${ideaComments} WHERE ${ideaComments.ideaId} = ${ideas.id})`,
    })
    .from(ideas)
    .innerJoin(users, eq(ideas.authorId, users.id))
    .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(or(eq(ideas.visibility, "public"), eq(ideas.authorId, session?.user?.id || "")))
    .orderBy(desc(ideas.createdAt))
    .all();

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mb: 1 }}>
            {tIdea("title")}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {tIdea("description")}
          </Typography>
        </Box>
        <LinkButton
          href="/ideas/new"
          variant="contained"
          startIcon={<AddIcon />}
          sx={{ flexShrink: 0 }}
        >
          {tIdea("postIdea")}
        </LinkButton>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {allIdeas.map((idea) => (
          <Card key={idea.id} variant="outlined" sx={{ transition: "0.2s", "&:hover": { borderColor: "primary.main" } }}>
            <LinkCardActionArea href={`/ideas/${idea.id}`} sx={{ p: 3 }}>
              <Box sx={{ display: "flex", gap: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                    {idea.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {idea.content}
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.secondary" }}>
                      <FavoriteIcon fontSize="small" />
                      <Typography variant="body2">{idea.likesCount}</Typography>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.secondary" }}>
                      <CommentIcon fontSize="small" />
                      <Typography variant="body2">{idea.commentsCount}</Typography>
                    </Box>
                    <Chip 
                      label={idea.status === "open" ? tIdea("status.open") : idea.status === "in_progress" ? tIdea("status.in_progress") : tIdea("status.resolved")} 
                      size="small" 
                      color={idea.status === "open" ? "primary" : idea.status === "in_progress" ? "warning" : "success"}
                      variant="outlined"
                    />
                    <Typography variant="caption" color="text.disabled" sx={{ ml: "auto" }}>
                      {formatDate(idea.createdAt!)}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </LinkCardActionArea>
          </Card>
        ))}
        {allIdeas.length === 0 && (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {tIdea("noIdeas")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {tIdea("postFirstIdea")}
            </Typography>
          </Box>
        )}
      </Box>
    </Container>
  );
}
