import Container from "@mui/material/Container";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";

/**
 * 設定画面の共通レイアウト。
 * セクションの切り替えは左のサイドバー（SettingsSidebar）が担うため、ここでは認証と枠だけを持つ。
 */
export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 6 }, px: { xs: 2, sm: 3 } }}>
      {children}
    </Container>
  );
}
