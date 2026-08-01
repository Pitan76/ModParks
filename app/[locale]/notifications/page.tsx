import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import SettingsIcon from "@mui/icons-material/Settings";
import LinkButton from "@/components/ui/LinkButton";
import { getNotifications } from "@/lib/queries/notifications";
import NotificationList from "@/components/notification/NotificationListLazy";
import MarkAllReadButton from "@/components/notification/MarkAllReadButton";

export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const t = await getTranslations("Notifications");
  const items = await getNotifications(session.user.id, 50);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>{t("title")}</Typography>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          {items.length > 0 && <MarkAllReadButton />}
          <LinkButton href="/settings/notifications" size="small" startIcon={<SettingsIcon />}>
            {t("settingsLink")}
          </LinkButton>
        </Box>
      </Box>

      {items.length === 0 ? (
        <Box sx={{ py: 6, textAlign: "center" }}>
          <Typography color="text.secondary">{t("empty")}</Typography>
        </Box>
      ) : (
        <NotificationList items={items} />
      )}
    </Container>
  );
}
