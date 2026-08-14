import { setRequestLocale } from "next-intl/server";
import { getAdminDb } from "@/lib/auth-helpers";
import RecipeAdminClient from "./RecipeAdminClientLazy";
import { redirect } from "@/lib/i18n/routing";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminRecipePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  try {
    await getAdminDb();
  } catch (e) {
    redirect({ href: "/", locale: locale });
  }

  return <RecipeAdminClient />;
}
