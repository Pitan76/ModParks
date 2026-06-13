import { getTranslations } from "next-intl/server";
import { setRequestLocale } from "next-intl/server";
import { getDb, getD1 } from "@/lib/db";
import { ideas, users, ideaLikes, ideaComments } from "@/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActionArea from "@mui/material/CardActionArea";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import FavoriteIcon from "@mui/icons-material/Favorite";
import CommentIcon from "@mui/icons-material/Comment";
import AddIcon from "@mui/icons-material/Add";
import { Link } from "@/i18n/routing";
import LinkButton from "@/components/ui/LinkButton";

export default async function IdeasPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");

  const d1 = await getD1();
  const db = getDb(d1);

  // Fetch ideas with author, like count, and comment count
  const allIdeas = await db
    .select({
      id: ideas.id,
      title: ideas.title,
      content: ideas.content,
      status: ideas.status,
      createdAt: ideas.createdAt,
      authorId: users.id,
      authorName: users.displayName,
      authorAvatar: users.avatarUrl,
      likesCount: sql<number>`(SELECT count(*) FROM ${ideaLikes} WHERE ${ideaLikes.ideaId} = ${ideas.id})`,
      commentsCount: sql<number>`(SELECT count(*) FROM ${ideaComments} WHERE ${ideaComments.ideaId} = ${ideas.id})`,
    })
    .from(ideas)
    .innerJoin(users, eq(ideas.authorId, users.id))
    .orderBy(desc(ideas.createdAt))
    .all();

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mb: 1 }}>
            アイデア (Ideas)
          </Typography>
          <Typography variant="body1" color="text.secondary">
            マイクラのMOD、プラグインをみんなで一緒につくったり、探したりしてみませんか？
          </Typography>
        </Box>
        <LinkButton
          href="/ideas/new"
          variant="contained"
          startIcon={<AddIcon />}
          sx={{ borderRadius: 8, px: 3 }}
        >
          アイデアを投稿
        </LinkButton>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {allIdeas.map((idea) => (
          <Card key={idea.id} variant="outlined" sx={{ borderRadius: 3, transition: "0.2s", "&:hover": { borderColor: "primary.main" } }}>
            <CardActionArea component={Link} href={`/ideas/${idea.id}`} sx={{ p: 3 }}>
              <Box sx={{ display: "flex", gap: 2 }}>
                <Avatar src={idea.authorAvatar || undefined} sx={{ width: 48, height: 48 }}>
                  {idea.authorName?.[0] || "U"}
                </Avatar>
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
                      label={idea.status === "open" ? "募集中" : idea.status === "in_progress" ? "開発中" : "実現済"} 
                      size="small" 
                      color={idea.status === "open" ? "primary" : idea.status === "in_progress" ? "warning" : "success"}
                      variant="outlined"
                    />
                    <Typography variant="caption" color="text.disabled" sx={{ ml: "auto" }}>
                      {new Date(idea.createdAt!).toLocaleDateString()}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </CardActionArea>
          </Card>
        ))}
        {allIdeas.length === 0 && (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              まだアイデアがありません
            </Typography>
            <Typography variant="body2" color="text.secondary">
              あなたの「こんなModが欲しい！」を投稿してみましょう！
            </Typography>
          </Box>
        )}
      </Box>
    </Container>
  );
}
