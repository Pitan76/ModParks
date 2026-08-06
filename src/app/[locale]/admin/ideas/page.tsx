import { getAdminDb } from "@/lib/auth-helpers";
import { listIdeaPosts } from "@/lib/queries/postList";
import Typography from "@mui/material/Typography";
import { getTranslations, setRequestLocale } from "next-intl/server";
import IdeasClient from "./IdeasClientLazy";

export default async function AdminIdeasPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tAdmin = await getTranslations("Admin.ideas");

  const { db } = await getAdminDb();
  // 管理画面なので下書き・非公開も含めて全件見る
  const ideaPosts = await listIdeaPosts(db, { includeHidden: true, limit: 1000 });

  // IdeasClient は平坦な authorUsername / authorDisplayName を期待する。
  // 変換はこの境界（ページ）だけで行い、IdeaPostView 自体には手を加えない。
  const allIdeas = ideaPosts.map((idea) => ({
    id: idea.id,
    title: idea.title,
    status: idea.status,
    createdAt: idea.createdAt,
    authorUsername: idea.author.username,
    authorDisplayName: idea.author.displayName,
  }));

  return (
    <>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: "bold" }}>
        {tAdmin("title")}
      </Typography>
      <IdeasClient ideas={allIdeas} />
    </>
  );
}
