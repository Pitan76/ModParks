import { getAdminDb } from "@/lib/auth-helpers";
import { users, userProfiles, userTrust } from "@/db/schema";
import { desc, eq, isNull, isNotNull, inArray, sql } from "drizzle-orm";
import Typography from "@mui/material/Typography";
import UsersClient from "./UsersClientLazy";
import { getTranslations, setRequestLocale } from "next-intl/server";
import PaginationControls from "@/components/ui/PaginationControls";

const ADMIN_USERS_PER_PAGE = 50;

interface AdminUsersPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; page?: string; limit?: string }>;
}

export default async function AdminUsersPage({ params, searchParams }: AdminUsersPageProps) {
  const { locale } = await params;
  const { tab: tabStr, page: pageStr, limit: limitStr } = await searchParams;
  setRequestLocale(locale);
  const tAdmin = await getTranslations("Admin.users");

  const { db } = await getAdminDb();

  const tabIndex = tabStr === "1" ? 1 : 0;
  const deletedFilter = tabIndex === 0 ? isNull(users.deletedAt) : isNotNull(users.deletedAt);

  const page = Math.max(1, parseInt(pageStr as string) || 1);
  const limit = Math.min(Math.max(parseInt(limitStr as string) || ADMIN_USERS_PER_PAGE, 10), 200);
  const offset = (page - 1) * limit;

  const { accounts } = await import("@/db/schema");

  const [pageUsers, activeCountResult, deletedCountResult] = await Promise.all([
    db.select({
        id: users.id,
        username: userProfiles.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
        deletedAt: users.deletedAt,
        deactivatedAt: users.deactivatedAt,
        suspendedAt: users.suspendedAt,
        twoFactorEnabled: users.twoFactorEnabled,
        premiumTier: users.premiumTier,
        premiumUntil: users.premiumUntil,
        trustScore: userTrust.score,
        trustTier: userTrust.tier,
    }).from(users)
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .leftJoin(userTrust, eq(users.id, userTrust.userId))
      .where(deletedFilter)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset)
      .all(),
    db.select({ count: sql<number>`count(*)` }).from(users).where(isNull(users.deletedAt)).get(),
    db.select({ count: sql<number>`count(*)` }).from(users).where(isNotNull(users.deletedAt)).get(),
  ]);

  const pageUserIds = pageUsers.map(u => u.id);
  const pageAccounts = pageUserIds.length
    ? await db.select({ userId: accounts.userId, provider: accounts.provider }).from(accounts).where(inArray(accounts.userId, pageUserIds)).all()
    : [];

  const mappedUsers = pageUsers.map(u => ({
    ...u,
    hasGithub: pageAccounts.some(acc => acc.userId === u.id && acc.provider === "github")
  }));

  const activeCount = activeCountResult?.count ?? 0;
  const deletedCount = deletedCountResult?.count ?? 0;
  const totalCount = tabIndex === 0 ? activeCount : deletedCount;

  return (
    <>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: "bold" }}>
        {tAdmin("title")}
      </Typography>
      <UsersClient users={mappedUsers} tabIndex={tabIndex} activeCount={activeCount} deletedCount={deletedCount} />
      {totalCount > 0 && (
        <PaginationControls totalCount={totalCount} currentPage={page} currentLimit={limit} sx={{ mt: 3 }} />
      )}
    </>
  );
}
