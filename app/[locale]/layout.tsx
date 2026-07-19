import type { Metadata, Viewport } from "next";

import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, AppLocale } from "@/i18n/routing";
import ThemeRegistry from "@/components/ThemeRegistry";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { SessionProvider } from "@/components/SessionProvider";
import AppLayout from "@/components/layout/AppLayout";
import AppFooter from "@/components/layout/AppFooter";
import LocaleSyncer from "@/components/layout/LocaleSyncer";
import { SITE_URL } from "@/lib/config";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#121212",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ModParks - Minecraft Mod & Plugin Platform",
    template: "%s | ModParks",
  },
  description: "Minecraft Java Edition向けのMod/Pluginを簡単に公開、検索、ダウンロードできる日本発プラットフォーム",
  keywords: ["Minecraft", "Mod", "Plugin", "Java Edition", "Fabric", "Forge", "Paper"],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ModParks",
  },
  formatDetection: {
    telephone: false,
  },
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
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "ModParks - Minecraft Mod & Plugin Platform",
    description: "Minecraft Java Edition向けのMod/Pluginを簡単に公開、検索、ダウンロードできる日本発プラットフォーム",
    images: [
      {
        url: SITE_URL + "/icon.png",
        width: 512,
        height: 512,
      },
    ],
  },
  alternates: {
    types: {
      "application/rss+xml": SITE_URL + "/feed.xml",
    },
  },
};

import PwaRegister from "@/components/PwaRegister";

type LocaleLayoutProps = {
  children: React.ReactNode;
  params:   Promise<{ locale: string }>;
};

/**
 * 言語別ルートのレイアウト
 * @param children ページコンテンツ
 * @param params 言語を含むパラメータ
 * @returns 言語別レイアウト
 */
const LocaleLayout = async ({ children, params }: LocaleLayoutProps) => {
  const { locale } = await params;

  // 未対応言語であれば404を返す
  if (!routing.locales.includes(locale as AppLocale)) notFound();

  const messages = await getMessages();
  const session  = await auth();

  let userLocale = null;
  if (session?.user?.id) {
    // 最新情報は auth.ts の jwt コールバックで 5分TTL キャッシュされているものを利用
    userLocale = (session.user as any).locale;
  }

  const cookieStore = await cookies();
  const themeMode = (cookieStore.get("theme_mode")?.value as "light" | "dark") || "dark";

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <PwaRegister />
        <ThemeRegistry initialMode={themeMode}>
          <SessionProvider session={session} refetchOnWindowFocus={false}>
            <NextIntlClientProvider messages={messages}>
              {userLocale && <LocaleSyncer userLocale={userLocale} />}
              <AppLayout session={session}>
                {children}
                <AppFooter />
              </AppLayout>
            </NextIntlClientProvider>
          </SessionProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}

export default LocaleLayout;
