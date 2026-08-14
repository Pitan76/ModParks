import { getAdminDb } from "@/lib/auth-helpers";
import { setRequestLocale } from "next-intl/server";
import { getBackups } from "@/lib/actions/adminBackupQuery";
import BackupClient from "@/components/admin/BackupClientLazy";
import { redirect } from "@/lib/i18n/routing";

interface BackupPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminBackupPage({ params }: BackupPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  try {
    await getAdminDb();
  } catch (e) {
    redirect({ href: "/", locale: locale });
  }

  const initialBackups = await getBackups();

  return <BackupClient initialBackups={initialBackups} locale={locale} />;
}
