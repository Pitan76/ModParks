import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { localePath } from "@/lib/i18n/localePath";

export default async function EditProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect(`/api/auth/signin?callbackUrl=${localePath(`/projects/${slug}/edit`, locale)}`);
  }

  return <>{children}</>;
}
