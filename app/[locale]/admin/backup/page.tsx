import { getAdminDb } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getBackups } from "@/lib/actions/adminBackupQuery";
import BackupClient from "@/components/admin/BackupClient";

interface BackupPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminBackupPage({ params }: BackupPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  try {
    await getAdminDb();
  } catch (e) {
    redirect("/");
  }

  const initialBackups = await getBackups();

  return <BackupClient initialBackups={initialBackups} locale={locale} />;
}
