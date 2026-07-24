import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getSettingsAudits, getBackupAudits } from "@/lib/actions/admin";
import LogsClient from "@/components/admin/LogsClientLazy";

interface LogsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminLogsPage({ params }: LogsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect(`/${locale}`);
  }

  // Fetch initial data (default limit = 10)
  const initialSettings = await getSettingsAudits(10, 0);
  const initialBackups = await getBackupAudits(10, 0);

  return (
    <LogsClient
      initialSettings={initialSettings}
      initialBackups={initialBackups}
    />
  );
}
