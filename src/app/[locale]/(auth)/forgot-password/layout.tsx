import { redirectIfAuthenticated } from "@/lib/auth-helpers";

/** ログイン済みのユーザーがゲスト専用画面を開けないようにするためだけのレイアウト */
export default async function GuestOnlyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await redirectIfAuthenticated(locale);
  return <>{children}</>;
}
