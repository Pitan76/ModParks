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
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import Breadcrumb from "@/components/ui/Breadcrumb";
import LinkButton from "@/components/ui/LinkButton";
import IdeaLikeButton from "@/components/idea/IdeaLikeButton";
import IdeaCommentForm from "@/components/idea/IdeaCommentForm";
import IdeaDetailCard from "@/components/idea/IdeaDetailCard";
import IdeaOwnerActions from "@/components/idea/IdeaOwnerActions";
import IdeaStatusControl from "@/components/idea/IdeaStatusControl";
import IdeaCommentItem from "@/components/idea/IdeaCommentItem";
import ShareMenuButton from "@/components/ui/ShareMenuButton";
import { formatDate } from "@/lib/utils/format";
import { Link } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SITE_URL } from "@/lib/config";
import DescriptionRenderer from "@/components/ui/DescriptionRenderer";

export async function generateMetadata({ params }: { params: Promise<{ locale: string, id: string }> }) {
  const { id, locale } = await params;
  const d1 = await getD1();
  const db = getDb(d1);

  const idea = await db
    .select({
      title: ideas.title,
      content: ideas.content,
      contentFormat: ideas.contentFormat,
      visibility: ideas.visibility,
    })
    .from(ideas)
    .where(eq(ideas.id, id))
    .get();

  if (!idea || idea.visibility !== "public") {
    return { title: "Not Found" };
  }

  const title = idea.title;
  const description = idea.content.length > 150 ? idea.content.substring(0, 150) + "..." : idea.content;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: SITE_URL + `/${locale}/ideas/${id}`,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    alternates: {
      canonical: `${SITE_URL}/${locale}/ideas/${id}`,
      languages: {
        ja: `${SITE_URL}/ja/ideas/${id}`,
        en: `${SITE_URL}/en/ideas/${id}`,
      },
    },
  };
}

export default async function IdeaDetailPage({ params }: { params: Promise<{ locale: string, id: string }> }) {
  const { id, locale } = await params;
  setRequestLocale(locale);
  const tIdea = await getTranslations("Idea");
  const tNav = await getTranslations("Nav");
  const tComment = await getTranslations("Comment");
  const session = await auth();

  const d1 = await getD1();
  const db = getDb(d1);

  // 1. Fetch Idea with Author
  const ideaData = await db
    .select({
      id: ideas.id,
      title: ideas.title,
      content: ideas.content,
      contentFormat: ideas.contentFormat,
      status: ideas.status,
      visibility: ideas.visibility,
      createdAt: ideas.createdAt,
      authorId: users.id,
      authorName: userProfiles.displayName,
      authorAvatar: userProfiles.avatarUrl,
      authorUsername: userProfiles.username,
    })
    .from(ideas)
    .innerJoin(users, eq(ideas.authorId, users.id))
    .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(eq(ideas.id, id))
    .get();

  if (!ideaData) return notFound();

  // 投稿者本人または管理者のみ編集/削除操作を表示
  const canManage =
    !!session?.user &&
    (session.user.id === ideaData.authorId || (session.user as any).role === "admin");

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
      contentFormat: ideaComments.contentFormat,
      createdAt: ideaComments.createdAt,
      updatedAt: ideaComments.updatedAt,
      parentId: ideaComments.parentId,
      authorId: ideaComments.authorId,
      authorName: userProfiles.displayName,
      authorAvatar: userProfiles.avatarUrl,
      authorUsername: userProfiles.username,
    })
    .from(ideaComments)
    .innerJoin(users, eq(ideaComments.authorId, users.id))
    .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(eq(ideaComments.ideaId, id))
    .orderBy(desc(ideaComments.createdAt))
    .all();

  // 4. Fetch Linked Versions and Source Idea Projects
  const [linkedVersions, sourceIdeaProjects] = await Promise.all([
    db
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
      .all(),
    db
      .select({
        projectId: projects.id,
        projectName: projects.name,
        projectSlug: projects.slug,
        projectDescription: projects.description,
      })
      .from(projects)
      .where(eq(projects.sourceIdeaId, id))
      .all(),
  ]);

  const resolvedProjectsMap = new Map();
  for (const p of sourceIdeaProjects) {
    resolvedProjectsMap.set(p.projectId, {
      projectId: p.projectId,
      projectName: p.projectName,
      projectSlug: p.projectSlug,
      projectDescription: p.projectDescription,
      versionNumber: null as string | null,
    });
  }
  for (const v of linkedVersions) {
    if (!resolvedProjectsMap.has(v.projectId)) {
      resolvedProjectsMap.set(v.projectId, {
        projectId: v.projectId,
        projectName: v.projectName,
        projectSlug: v.projectSlug,
        projectDescription: v.projectDescription,
        versionNumber: v.versionNumber,
      });
    } else {
      const existing = resolvedProjectsMap.get(v.projectId);
      if (!existing.versionNumber) existing.versionNumber = v.versionNumber;
    }
  }
  const resolvedProjects = Array.from(resolvedProjectsMap.values());

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 }, px: { xs: 2, sm: 3 } }}>
      <Breadcrumb
        items={[
          { label: tNav("ideas"), href: "/ideas" },
          { label: ideaData.title },
        ]}
      />

      {/* Idea Content */}
      <IdeaDetailCard>
          <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 3 }}>
            <Link
              href={`/profile/${ideaData.authorUsername}`}
              style={{
                textDecoration: "none",
                color: "inherit",
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <Avatar src={ideaData.authorAvatar || undefined} sx={{ width: 48, height: 48 }}>
                {ideaData.authorName?.[0] || "U"}
              </Avatar>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2, "&:hover": { textDecoration: "underline" } }}>
                  {ideaData.authorName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatDate(ideaData.createdAt!)}
                </Typography>
              </Box>
            </Link>
            <Box sx={{ flexGrow: 1 }} />
            {canManage && (
              <IdeaOwnerActions
                ideaId={id}
                initialTitle={ideaData.title}
                initialContent={ideaData.content}
                initialContentFormat={ideaData.contentFormat}
                initialVisibility={ideaData.visibility ?? "public"}
              />
            )}
          </Box>

          <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mb: 3, fontSize: { xs: "1.6rem", sm: "2.125rem" }, wordBreak: "break-word", overflowWrap: "anywhere" }}>
            {ideaData.title}
          </Typography>

          <Box sx={{ mb: 4 }}>
            <DescriptionRenderer content={ideaData.content} format={ideaData.contentFormat} />
          </Box>

          <Box sx={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: { xs: "stretch", sm: "center" },
            flexDirection: { xs: "column", sm: "row" },
            gap: 2
          }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <IdeaLikeButton 
                ideaId={id} 
                initialCount={initialCount} 
                initialLiked={initialLiked} 
                isLoggedIn={!!session} 
                variant="icon"
              />
              <ShareMenuButton
                url={`${SITE_URL}/ideas/${id}`}
                title={ideaData.title}
              />
            </Box>
            <Box sx={{ 
              display: "flex", 
              alignItems: "center", 
              gap: 2, 
              flexWrap: "wrap",
              justifyContent: { xs: "flex-start", sm: "flex-end" }
            }}>
              {session?.user && ideaData.status !== "fulfilled" && (
                <LinkButton 
                  variant="contained" 
                  size="small" 
                  href={`/projects/new?ideaId=${id}`}
                  sx={{ whiteSpace: "nowrap" }}
                >
                  {tIdea("createProject")}
                </LinkButton>
              )}
              {canManage ? (
                <IdeaStatusControl ideaId={id} initialStatus={ideaData.status} />
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                  {tIdea("statusLabel", { status: ideaData.status === "open" ? tIdea("status.open") : ideaData.status === "in_progress" ? tIdea("status.in_progress") : tIdea("status.resolved") })}
                </Typography>
              )}
            </Box>
          </Box>
      </IdeaDetailCard>

      {/* Resolved Projects */}
      {resolvedProjects.length > 0 && (
        <Box sx={{ mb: 6 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
            <CheckCircleIcon color="success" />
            {tIdea("resolvedBy")}
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {resolvedProjects.map((p) => (
              <Card key={p.projectId} variant="outlined" sx={{ borderRadius: 2, bgcolor: "success.50", borderColor: "success.main" }}>
                <CardContent sx={{ py: 2, display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" }, gap: 2, "&:last-child": { pb: 2 } }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: "success.dark", wordBreak: "break-word" }}>
                      {p.projectName} {p.versionNumber ? `(v${p.versionNumber})` : ""}
                    </Typography>
                    {p.projectDescription && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {p.projectDescription}
                      </Typography>
                    )}
                  </Box>
                  <LinkButton variant="outlined" size="small" href={`/projects/${p.projectSlug}`} sx={{ flexShrink: 0, whiteSpace: "nowrap" }}>
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
        {session?.user ? (
          <Box sx={{ mb: 4 }}>
            <IdeaCommentForm ideaId={id} commentsCount={comments.length} />
          </Box>
        ) : (
          <>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>
              {tComment("titleWithCount", { count: comments.length })}
            </Typography>
            <Box sx={{ p: 3, textAlign: "center", bgcolor: "background.paper", borderRadius: 2, border: "1px dashed", borderColor: "divider", mb: 4 }}>
              <Typography color="text.secondary">
                {tComment("loginPrompt")}
              </Typography>
            </Box>
          </>
        )}

        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {comments.filter((c) => !c.parentId).map((comment) => {
            const isCommentAuthor = session?.user?.id === comment.authorId;
            return (
              <IdeaCommentItem
                key={comment.id}
                id={comment.id}
                ideaId={id}
                content={comment.content}
                contentFormat={comment.contentFormat}
                createdAt={comment.createdAt}
                updatedAt={comment.updatedAt}
                authorName={comment.authorName}
                authorAvatar={comment.authorAvatar}
                authorUsername={comment.authorUsername}
                canEdit={isCommentAuthor}
                canDelete={isCommentAuthor || canManage}
                isLoggedIn={!!session?.user}
                replies={comments
                  .filter((r) => r.parentId === comment.id)
                  .map((r) => ({
                    id: r.id,
                    content: r.content,
                    contentFormat: r.contentFormat,
                    createdAt: r.createdAt,
                    updatedAt: r.updatedAt,
                    authorName: r.authorName,
                    authorAvatar: r.authorAvatar,
                    authorUsername: r.authorUsername,
                    canEdit: session?.user?.id === r.authorId,
                    canDelete: session?.user?.id === r.authorId || canManage,
                  }))}
              />
            );
          })}
          {comments.length === 0 && (
            <Typography color="text.secondary">{tComment("empty")}</Typography>
          )}
        </Box>
      </Box>

    </Container>
  );
}
