import { getAdminDb } from "@/lib/auth-helpers";
import { listIdeaPosts, countIdeaPosts } from "@/lib/queries/postList";
import Typography from "@mui/material/Typography";
import { getTranslations, setRequestLocale } from "next-intl/server";
import IdeasClient from "./IdeasClientLazy";
import PaginationControls from "@/components/ui/PaginationControls";

const ADMIN_IDEAS_PER_PAGE = 50;

interface AdminIdeasPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; limit?: string }>;
}

export default async function AdminIdeasPage({ params, searchParams }: AdminIdeasPageProps) {
  const { locale } = await params;
  const { page: pageStr, limit: limitStr } = await searchParams;
  setRequestLocale(locale);
  const tAdmin = await getTranslations("Admin.ideas");

  const { db } = await getAdminDb();

  const page = Math.max(1, parseInt(pageStr as string) || 1);
  const limit = Math.min(Math.max(parseInt(limitStr as string) || ADMIN_IDEAS_PER_PAGE, 10), 200);
  const offset = (page - 1) * limit;

  // 管理画面なので下書き・非公開も含めて見る
  const [ideaPosts, totalCount] = await Promise.all([
    listIdeaPosts(db, { includeHidden: true, limit, offset }),
    countIdeaPosts(db, { includeHidden: true }),
  ]);

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
      {totalCount > 0 && (
        <PaginationControls totalCount={totalCount} currentPage={page} currentLimit={limit} sx={{ mt: 3 }} />
      )}
    </>
  );
}
