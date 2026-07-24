import { setRequestLocale } from "next-intl/server";
import { getAdminDb } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import RecipeAdminClient from "./RecipeAdminClient";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminRecipePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  try {
    await getAdminDb();
  } catch (e) {
    redirect("/");
  }

  return <RecipeAdminClient />;
}
