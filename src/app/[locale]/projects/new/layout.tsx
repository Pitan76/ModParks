import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { localePath } from "@/lib/i18n/localePath";

export default async function NewProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect(`/api/auth/signin?callbackUrl=${localePath(`/projects/new`, locale)}`);
  }

  return <>{children}</>;
}
