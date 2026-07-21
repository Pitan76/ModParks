import { getTranslations } from "next-intl/server";
import { setRequestLocale } from "next-intl/server";
import { getDatabase } from "@/lib/db";
import { ideas, users, userProfiles, ideaLikes, ideaComments } from "@/db/schema";
import { eq, sql, desc, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import AddIcon from "@mui/icons-material/Add";
import LinkButton from "@/components/ui/LinkButton";
import IdeaCardList from "@/components/idea/IdeaCardList";

export default async function IdeasPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
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
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 6 }, px: { xs: 2, sm: 3 } }}>
      <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" }, gap: 2, mb: 4 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mb: 1, fontSize: { xs: "1.6rem", sm: "2.125rem" } }}>
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
          sx={{ flexShrink: 0, width: { xs: "100%", sm: "auto" }, whiteSpace: "nowrap" }}
        >
          {tIdea("postIdea")}
        </LinkButton>
      </Box>

      <IdeaCardList ideas={allIdeas as any} />
    </Container>
  );
}
