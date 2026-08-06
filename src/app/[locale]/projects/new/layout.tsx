import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

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
    redirect(`/api/auth/signin?callbackUrl=/${locale}/projects/new`);
  }

  return <>{children}</>;
}
