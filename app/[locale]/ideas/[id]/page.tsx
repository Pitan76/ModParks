import { notFound } from "next/navigation";
import { getDb, getD1 } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ideas, ideaLikes, ideaComments, users, versions, versionIdeas, projects } from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LinkButton from "@/components/ui/LinkButton";
import { Link } from "@/i18n/routing";
import IdeaLikeButton from "@/components/idea/IdeaLikeButton";
import IdeaCommentForm from "@/components/idea/IdeaCommentForm";

export default async function IdeaDetailPage({ params }: { params: Promise<{ locale: string, id: string }> }) {
  const { id } = await params;
  const session = await auth();

  const d1 = await getD1();
  const db = getDb(d1);

  // 1. Fetch Idea with Author
  const ideaData = await db
    .select({
      id: ideas.id,
      title: ideas.title,
      content: ideas.content,
      status: ideas.status,
      createdAt: ideas.createdAt,
      authorId: users.id,
      authorName: users.displayName,
      authorAvatar: users.avatarUrl,
    })
    .from(ideas)
    .innerJoin(users, eq(ideas.authorId, users.id))
    .where(eq(ideas.id, id))
    .get();

  if (!ideaData) return notFound();

  // 2. Fetch Likes
  const [likesData, userLike] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(ideaLikes).where(eq(ideaLikes.ideaId, id)).get(),
    session?.user?.id ? db.select().from(ideaLikes).where(and(eq(ideaLikes.ideaId, id), eq(ideaLikes.userId, session.user.id))).get() : null
  ]);

  const initialCount = likesData?.count || 0;
  const initialLiked = !!userLike;

  // 3. Fetch Comments
  const comments = await db
    .select({
      id: ideaComments.id,
      content: ideaComments.content,
      createdAt: ideaComments.createdAt,
      authorName: users.displayName,
      authorAvatar: users.avatarUrl,
    })
    .from(ideaComments)
    .innerJoin(users, eq(ideaComments.authorId, users.id))
    .where(eq(ideaComments.ideaId, id))
    .orderBy(desc(ideaComments.createdAt))
    .all();

  // 4. Fetch Linked Versions (Mods that fulfill this idea)
  const linkedVersions = await db
    .select({
      versionId: versions.id,
      versionNumber: versions.versionNumber,
      projectId: projects.id,
      projectName: projects.name,
      projectSlug: projects.slug,
    })
    .from(versionIdeas)
    .innerJoin(versions, eq(versionIdeas.versionId, versions.id))
    .innerJoin(projects, eq(versions.projectId, projects.id))
    .where(eq(versionIdeas.ideaId, id))
    .all();

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Box sx={{ mb: 3 }}>
        <LinkButton href="/ideas" variant="text" color="inherit" startIcon={<ArrowBackIcon />}>
          アイデア一覧に戻る
        </LinkButton>
      </Box>

      {/* Idea Content */}
      <Card variant="outlined" sx={{ borderRadius: 3, mb: 4 }}>
        <CardContent sx={{ p: { xs: 3, md: 5 } }}>
          <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 3 }}>
            <Avatar src={ideaData.authorAvatar || undefined} sx={{ width: 48, height: 48 }}>
              {ideaData.authorName?.[0] || "U"}
            </Avatar>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                {ideaData.authorName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {new Date(ideaData.createdAt!).toLocaleString()}
              </Typography>
            </Box>
          </Box>

          <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mb: 3 }}>
            {ideaData.title}
          </Typography>

          <Typography variant="body1" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.8, mb: 4 }}>
            {ideaData.content}
          </Typography>

          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <IdeaLikeButton ideaId={id} initialCount={initialCount} initialLiked={initialLiked} />
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
              ステータス: {ideaData.status === "open" ? "募集中" : ideaData.status === "in_progress" ? "開発中" : "実現済"}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Linked Versions */}
      {linkedVersions.length > 0 && (
        <Box sx={{ mb: 6 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            このアイデアを実現したMod
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {linkedVersions.map((v) => (
              <Card key={v.versionId} variant="outlined" sx={{ borderRadius: 2, bgcolor: "success.50", borderColor: "success.main" }}>
                <CardContent sx={{ py: 2, display: "flex", justifyContent: "space-between", alignItems: "center", "&:last-child": { pb: 2 } }}>
                  <Typography variant="body1" sx={{ fontWeight: 600, color: "success.dark" }}>
                    {v.projectName} (v{v.versionNumber})
                  </Typography>
                  <LinkButton href={`/projects/${v.projectSlug}`} variant="contained" color="success" size="small" sx={{ borderRadius: 8 }}>
                    プロジェクトを見る
                  </LinkButton>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Box>
      )}

      {/* Comments */}
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
          コメント ({comments.length})
        </Typography>

        {session?.user ? (
          <Box sx={{ mb: 4 }}>
            <IdeaCommentForm ideaId={id} />
          </Box>
        ) : (
          <Typography color="text.secondary" sx={{ mb: 4 }}>
            コメントするにはログインが必要です。
          </Typography>
        )}

        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {comments.map((comment) => (
            <Box key={comment.id} sx={{ display: "flex", gap: 2 }}>
              <Avatar src={comment.authorAvatar || undefined} sx={{ width: 40, height: 40 }}>
                {comment.authorName?.[0] || "U"}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 0.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {comment.authorName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(comment.createdAt!).toLocaleString()}
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                  {comment.content}
                </Typography>
              </Box>
            </Box>
          ))}
          {comments.length === 0 && (
            <Typography color="text.secondary">まだコメントはありません。</Typography>
          )}
        </Box>
      </Box>

    </Container>
  );
}
