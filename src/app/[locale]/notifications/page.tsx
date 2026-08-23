import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import SettingsLink from "@/components/ui/SettingsLink";
import { getNotifications, countNotifications } from "@/lib/queries/notifications";
import NotificationList from "@/components/notification/NotificationListLazy";
import MarkAllReadButton from "@/components/notification/MarkAllReadButton";
import PaginationControls from "@/components/ui/PaginationControls";
import { redirect } from "@/lib/i18n/routing";

const NOTIFICATIONS_PER_PAGE = 20;

interface NotificationsPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; limit?: string }>;
}

export default async function NotificationsPage({ params, searchParams }: NotificationsPageProps) {
  const { locale } = await params;
  const { page: pageStr, limit: limitStr } = await searchParams;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect({ href: `/login`, locale: locale });

  const t = await getTranslations("Notifications");

  const page = Math.max(1, parseInt(pageStr ?? "") || 1);
  const limit = Math.min(Math.max(parseInt(limitStr ?? "") || NOTIFICATIONS_PER_PAGE, 10), 80);

  const [items, totalCount] = await Promise.all([
    getNotifications(session.user.id, limit, (page - 1) * limit),
    countNotifications(session.user.id),
  ]);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>{t("title")}</Typography>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          {totalCount > 0 && <MarkAllReadButton />}
          <SettingsLink href="/settings/notifications" label={t("settingsLink")} />
        </Box>
      </Box>

      {items.length === 0 ? (
        <Box sx={{ py: 6, textAlign: "center" }}>
          <Typography color="text.secondary">{t("empty")}</Typography>
        </Box>
      ) : (
        <NotificationList items={items} />
      )}

      <PaginationControls totalCount={totalCount} currentPage={page} currentLimit={limit} />
    </Container>
  );
}
