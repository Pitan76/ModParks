import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import ThemeRegistry from "@/components/ThemeRegistry";
import Box from "@mui/material/Box";
import { auth } from "@/lib/auth";
import { getDb, getD1 } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import AppLayout from "@/components/layout/AppLayout";
import AppFooter from "@/components/layout/AppFooter";

export const metadata: Metadata = {
  title: {
    default: "ModParks | Minecraft Mod & Plugin Platform",
    template: "%s | ModParks",
  },
  description:
    "Minecraft Java Edition向けのMod/Pluginを簡単に公開、検索、ダウンロードできる日本発プラットフォーム",
  keywords: ["Minecraft", "Mod", "Plugin", "Java Edition", "Fabric", "Forge", "Paper"],
  openGraph: {
    type:    "website",
    locale:  "ja_JP",
    url:     "https://modparks.dev",
    siteName: "ModParks",
  },
};

interface LocaleLayoutProps {
  children: React.ReactNode;
  params:   Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  // ロケール検証
  if (!routing.locales.includes(locale as "ja" | "en")) {
    notFound();
  }

  const messages = await getMessages();
  const session  = await auth();

  if (session?.user?.id) {
    // 常に最新のプロフィール情報（特にアバター）を取得して上書き
    const d1 = await getD1();
    const db = getDb(d1);
    const dbUser = await db.select().from(users).where(eq(users.id, session.user.id)).get();
    if (dbUser) {
      session.user.avatarUrl = dbUser.avatarUrl;
      session.user.displayName = dbUser.displayName;
    }
  }

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <ThemeRegistry>
          <NextIntlClientProvider messages={messages}>
            <AppLayout session={session}>
              {children}
              <AppFooter />
            </AppLayout>
          </NextIntlClientProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
