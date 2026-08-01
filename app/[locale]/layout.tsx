import type { Metadata, Viewport } from "next";
import Script from "next/script";

const GA_ID = "G-5N4ZEX76T6";

import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, AppLocale } from "@/lib/i18n/routing";
import { pickRootMessages } from "@/lib/i18n/clientMessages";
import ThemeRegistry from "@/components/ThemeRegistry";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { SessionProvider } from "@/components/SessionProvider";
import AppLayout from "@/components/layout/AppLayout";
import PinProvider from "@/components/pin/PinProvider";
import AppFooter from "@/components/layout/AppFooter";
import LocaleSyncer from "@/components/layout/LocaleSyncer";
import { SITE_URL } from "@/lib/config";
import { getAdsMode, getAdsenseClient } from "@/lib/config/ads";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#121212",
};

export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: t("title"),
      template: "%s | ModParks",
    },
    description: t("description"),
    keywords: t("keywords").split(",").map((k) => k.trim()),
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
      type: "website",
      locale: locale === "ja" ? "ja_JP" : "en_US",
      url: SITE_URL,
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
      title: t("title"),
      description: t("description"),
      images: [
        {
          url: SITE_URL + "/icon.png",
          width: 512,
          height: 512,
        },
      ],
    },
    alternates: {
      canonical: `${SITE_URL}/${locale}`,
      languages: {
        ja: `${SITE_URL}/ja`,
        en: `${SITE_URL}/en`,
      },
      types: {
        "application/rss+xml": SITE_URL + "/feed.xml",
      },
    },
  };
}

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
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

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

  const [messages, session] = await Promise.all([getMessages(), auth()]);

  let userLocale = null;
  if (session?.user?.id) {
    // 最新情報は auth.ts の jwt コールバックで 5分TTL キャッシュされているものを利用
    userLocale = (session.user as any).locale;
  }

  const cookieStore = await cookies();
  const themeMode = (cookieStore.get("theme_mode")?.value as "light" | "dark") || "dark";

  // 実配信モードのときだけ AdSense を読み込む（枠ごとではなくページで一度だけ）
  // プレミアムは広告非表示のため、スクリプト自体も読み込まない
  const adsenseClient = getAdsMode() === "on" && !session?.user?.isPremium
    ? getAdsenseClient()
    : "";

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Google Analytics (gtag.js) */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', '${GA_ID}');
          `}
        </Script>

        {/* Google AdSense */}
        {adsenseClient && (
          <Script
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
      </head>
      <body>
        <PwaRegister />
        <ThemeRegistry initialMode={themeMode}>
          <SessionProvider session={session} refetchOnWindowFocus={false}>
            <NextIntlClientProvider messages={pickRootMessages(messages)}>
              {userLocale && <LocaleSyncer userLocale={userLocale} />}
              <PinProvider>
                <AppLayout session={session}>
                  {children}
                  <AppFooter />
                </AppLayout>
              </PinProvider>
            </NextIntlClientProvider>
          </SessionProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}

export default LocaleLayout;
