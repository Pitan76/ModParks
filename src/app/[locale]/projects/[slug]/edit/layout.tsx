import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

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
    redirect(`/api/auth/signin?callbackUrl=/${locale}/projects/${slug}/edit`);
  }

  return <>{children}</>;
}
