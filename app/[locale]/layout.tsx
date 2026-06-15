import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import ThemeRegistry from "@/components/ThemeRegistry";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import AppLayout from "@/components/layout/AppLayout";
import AppFooter from "@/components/layout/AppFooter";
import LocaleSyncer from "@/components/layout/LocaleSyncer";
import { SITE_URL } from "@/lib/config";

export const metadata: Metadata = {
  title: {
    default: "ModParks - Minecraft Mod & Plugin Platform",
    template: "%s | ModParks",
  },
  description: "Minecraft Java Edition向けのMod/Pluginを簡単に公開、検索、ダウンロードできる日本発プラットフォーム",
  keywords: ["Minecraft", "Mod", "Plugin", "Java Edition", "Fabric", "Forge", "Paper"],
  openGraph: {
    type:    "website",
    locale:  "ja_JP",
    url:     SITE_URL,
    siteName: "ModParks",
    images: [
      {
        url: SITE_URL + "/icon.png",
        width: 512,
        height: 512,
        alt: "ModParks Logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "ModParks - Minecraft Mod & Plugin Platform",
    description: "Minecraft Java Edition向けのMod/Pluginを簡単に公開、検索、ダウンロードできる日本発プラットフォーム",
    images: [SITE_URL + "/icon.png"],
  },
  alternates: {
    types: {
      "application/rss+xml": SITE_URL + "/feed.xml",
    },
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

  let userLocale = null;
  if (session?.user?.id) {
    // 常に最新のプロフィール情報（特にアバター）を取得して上書き
    const db = await getDatabase();
    const dbUser = await db.select().from(users).where(eq(users.id, session.user.id)).get();
    if (dbUser) {
      session.user.avatarUrl = dbUser.avatarUrl;
      session.user.displayName = dbUser.displayName ?? "";
      session.user.username = dbUser.username;
      userLocale = dbUser.locale;
    }
  }

  const cookieStore = await cookies();
  const themeMode = (cookieStore.get("theme_mode")?.value as "light" | "dark") || "dark";

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <ThemeRegistry initialMode={themeMode}>
          <NextIntlClientProvider messages={messages}>
            {userLocale && <LocaleSyncer userLocale={userLocale} />}
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
