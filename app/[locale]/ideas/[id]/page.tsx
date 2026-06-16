import { notFound } from "next/navigation";
import { getDb, getD1 } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ideas, ideaLikes, ideaComments, users, userProfiles, versions, versionIdeas, projects } from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HomeIcon from "@mui/icons-material/Home";
import LinkButton from "@/components/ui/LinkButton";
import { Link } from "@/i18n/routing";
import IdeaLikeButton from "@/components/idea/IdeaLikeButton";
import IdeaCommentForm from "@/components/idea/IdeaCommentForm";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function IdeaDetailPage({ params }: { params: Promise<{ locale: string, id: string }> }) {
  const { id, locale } = await params;
  setRequestLocale(locale);
  const tIdea = await getTranslations("Idea");
  const tNav = await getTranslations("Nav");
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
      authorName: userProfiles.displayName,
      authorAvatar: userProfiles.avatarUrl,
    })
    .from(ideas)
    .innerJoin(users, eq(ideas.authorId, users.id))
    .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
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
      authorName: userProfiles.displayName,
      authorAvatar: userProfiles.avatarUrl,
    })
    .from(ideaComments)
    .innerJoin(users, eq(ideaComments.authorId, users.id))
    .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(eq(ideaComments.ideaId, id))
    .orderBy(desc(ideaComments.createdAt))
    .all();

  // 4. Fetch Linked Versions
  const linkedVersions = await db
    .select({
      versionId: versions.id,
      versionNumber: versions.versionNumber,
      projectId: projects.id,
      projectName: projects.name,
      projectSlug: projects.slug,
      projectDescription: projects.description,
    })
    .from(versionIdeas)
    .innerJoin(versions, eq(versionIdeas.versionId, versions.id))
    .innerJoin(projects, eq(versions.projectId, projects.id))
    .where(eq(versionIdeas.ideaId, id))
    .all();

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, typography: "body2", color: "text.secondary" }}>
          <LinkButton href="/" variant="text" sx={{ p: 0, minWidth: "auto", color: "text.secondary", "&:hover": { bgcolor: "transparent", color: "primary.main" } }}>
            <HomeIcon fontSize="small" />
          </LinkButton>
          <span>/</span>
          <LinkButton href="/ideas" variant="text" sx={{ p: 0, minWidth: "auto", color: "text.secondary", "&:hover": { bgcolor: "transparent", color: "primary.main" } }}>
            {tNav("ideas")}
          </LinkButton>
          <span>/</span>
          <Typography variant="body2" color="text.primary" sx={{ fontWeight: 500 }}>
            {ideaData.title}
          </Typography>
        </Box>
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
            <IdeaLikeButton 
              ideaId={id} 
              initialCount={initialCount} 
              initialLiked={initialLiked} 
              isLoggedIn={!!session} 
            />
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
              {tIdea("statusLabel", { status: ideaData.status === "open" ? tIdea("status.open") : ideaData.status === "in_progress" ? tIdea("status.in_progress") : tIdea("status.resolved") })}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Linked Versions */}
      {linkedVersions.length > 0 && (
        <Box sx={{ mb: 6 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
            <CheckCircleIcon color="success" />
            {tIdea("resolvedBy")}
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {linkedVersions.map((v) => (
              <Card key={v.versionId} variant="outlined" sx={{ borderRadius: 2, bgcolor: "success.50", borderColor: "success.main" }}>
                <CardContent sx={{ py: 2, display: "flex", justifyContent: "space-between", alignItems: "center", "&:last-child": { pb: 2 } }}>
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: "success.dark" }}>
                      {v.projectName} (v{v.versionNumber})
                    </Typography>
                    {v.projectDescription && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {v.projectDescription}
                      </Typography>
                    )}
                  </Box>
                  <LinkButton variant="outlined" size="small" href={`/projects/${v.projectSlug}`}>
                    {tIdea("viewProject")}
                  </LinkButton>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Box>
      )}

      {/* Comments */}
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>
          {tIdea("comments", { count: comments.length })}
        </Typography>

        {session?.user ? (
          <Box sx={{ mb: 4 }}>
            <IdeaCommentForm ideaId={id} />
          </Box>
        ) : (
          <Box sx={{ p: 3, textAlign: "center", bgcolor: "background.paper", borderRadius: 2, border: "1px dashed", borderColor: "divider", mb: 4 }}>
            <Typography color="text.secondary">
              {tIdea("loginToComment")}
            </Typography>
          </Box>
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
            <Typography color="text.secondary">{tIdea("noComments")}</Typography>
          )}
        </Box>
      </Box>

    </Container>
  );
}
