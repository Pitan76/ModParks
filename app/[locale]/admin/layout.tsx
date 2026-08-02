import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { setRequestLocale, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { pickAdminMessages } from "@/lib/i18n/clientMessages";
import Box from "@mui/material/Box";

/** 管理者専用画面なので検索結果に出さない */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  
  if (!session?.user) {
    redirect(`/api/auth/signin?callbackUrl=/${locale}/admin`);
  }
  if (session.user.role !== "admin") {
    redirect(`/${locale}`);
  }

  // Check if admin has set a password for security
  const { getDatabase } = await import("@/lib/db");
  const { users } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const db = await getDatabase();
  const currentUser = await db.select().from(users).where(eq(users.id, session.user.id)).get();
  if (currentUser && !currentUser.passwordHash) {
    redirect(`/${locale}/settings?error=admin_password_required`);
  }

  // ルートレイアウトは Admin をサイドバー分しか配っていないため、ここで全量に差し替える。
  // 入れ子の Provider は messages を置換するので、共通分を含めた完成形を渡す
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={pickAdminMessages(messages)}>
      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 4 }, overflow: "auto", height: "100%" }}>
        {children}
      </Box>
    </NextIntlClientProvider>
  );
}
