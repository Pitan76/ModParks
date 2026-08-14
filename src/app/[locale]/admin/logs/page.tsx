import { auth } from "@/lib/auth";
import { setRequestLocale } from "next-intl/server";
import { getSettingsAudits, getBackupAudits, getDdosAudits } from "@/lib/actions/admin";
import LogsClient from "@/components/admin/LogsClientLazy";
import { isAdminSession } from "@/lib/auth/roles";
import { redirect } from "@/lib/i18n/routing";

interface LogsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminLogsPage({ params }: LogsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!isAdminSession(session)) {
    redirect({ href: "/", locale: locale });
  }

  // Fetch initial data (default limit = 10)
  const initialSettings = await getSettingsAudits(10, 0);
  const initialBackups = await getBackupAudits(10, 0);
  const initialDdos = await getDdosAudits(10, 0);

  return (
    <LogsClient
      initialSettings={initialSettings}
      initialBackups={initialBackups}
      initialDdos={initialDdos}
    />
  );
}
