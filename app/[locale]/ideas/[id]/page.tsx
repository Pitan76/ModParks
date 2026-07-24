import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Breadcrumb from "@/components/ui/Breadcrumb";
import LinkButton from "@/components/ui/LinkButton";
import IdeaLikeButton from "@/components/idea/IdeaLikeButton";
import IdeaDetailCard from "@/components/idea/IdeaDetailCard";
import IdeaOwnerActions from "@/components/idea/IdeaOwnerActions";
import IdeaStatusControl from "@/components/idea/IdeaStatusControl";
import ShareMenuButton from "@/components/ui/ShareMenuButton";
import DescriptionRenderer from "@/components/ui/DescriptionRenderer";
import { formatDate } from "@/lib/utils/format";
import { Link } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SITE_URL } from "@/lib/config";
import { getIdeaMeta, getIdeaDetail } from "./ideaDetailData";
import ResolvedProjects from "./ResolvedProjects";
import IdeaComments from "./IdeaComments";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id, locale } = await params;
  const idea = await getIdeaMeta(id);
  if (!idea || idea.visibility !== "public") return { title: "Not Found" };

  const title = idea.title;
  const description = idea.content.length > 150 ? idea.content.substring(0, 150) + "..." : idea.content;

  return {
    title,
    description,
    openGraph: { title, description, type: "article", url: SITE_URL + `/${locale}/ideas/${id}` },
    twitter: { card: "summary", title, description },
    alternates: {
      canonical: `${SITE_URL}/${locale}/ideas/${id}`,
      languages: { ja: `${SITE_URL}/ja/ideas/${id}`, en: `${SITE_URL}/en/ideas/${id}` },
    },
  };
}

export default async function IdeaDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id, locale } = await params;
  setRequestLocale(locale);
  const tIdea = await getTranslations("Idea");
  const tNav = await getTranslations("Nav");
  const session = await auth();

  const detail = await getIdeaDetail(id, session?.user?.id);
  if (!detail) return notFound();

  const { ideaData, initialCount, initialLiked, comments, resolvedProjects } = detail;
  const canManage =
    !!session?.user && (session.user.id === ideaData.authorId || (session.user as any).role === "admin");

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 }, px: { xs: 2, sm: 3 } }}>
      <Breadcrumb items={[{ label: tNav("ideas"), href: "/ideas" }, { label: ideaData.title }]} />

      <IdeaDetailCard>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 3 }}>
          <Link
            href={`/profile/${ideaData.authorUsername}`}
            style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: 16 }}
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

        <Typography
          variant="h4"
          component="h1"
          sx={{ fontWeight: 800, mb: 3, fontSize: { xs: "1.6rem", sm: "2.125rem" }, wordBreak: "break-word", overflowWrap: "anywhere" }}
        >
          {ideaData.title}
        </Typography>

        <Box sx={{ mb: 4 }}>
          <DescriptionRenderer content={ideaData.content} format={ideaData.contentFormat} />
        </Box>

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: { xs: "stretch", sm: "center" },
            flexDirection: { xs: "column", sm: "row" },
            gap: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <IdeaLikeButton ideaId={id} initialCount={initialCount} initialLiked={initialLiked} isLoggedIn={!!session} variant="icon" />
            <ShareMenuButton url={`${SITE_URL}/ideas/${id}`} title={ideaData.title} />
          </Box>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              flexWrap: "wrap",
              justifyContent: { xs: "flex-start", sm: "flex-end" },
            }}
          >
            {session?.user && ideaData.status !== "fulfilled" && (
              <LinkButton variant="contained" size="small" href={`/projects/new?ideaId=${id}`} sx={{ whiteSpace: "nowrap" }}>
                {tIdea("createProject")}
              </LinkButton>
            )}
            {canManage ? (
              <IdeaStatusControl ideaId={id} initialStatus={ideaData.status} />
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                {tIdea("statusLabel", {
                  status:
                    ideaData.status === "open"
                      ? tIdea("status.open")
                      : ideaData.status === "in_progress"
                      ? tIdea("status.in_progress")
                      : tIdea("status.resolved"),
                })}
              </Typography>
            )}
          </Box>
        </Box>
      </IdeaDetailCard>

      <ResolvedProjects projects={resolvedProjects} />

      <IdeaComments
        ideaId={id}
        comments={comments}
        currentUserId={session?.user?.id}
        isLoggedIn={!!session?.user}
        canManage={canManage}
      />
    </Container>
  );
}
