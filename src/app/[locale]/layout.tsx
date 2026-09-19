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
import SessionBootstrap from "@/components/auth/SessionBootstrap";
import AppLayout from "@/components/layout/AppLayout";
import PinProvider from "@/components/pin/PinProvider";
import AppFooter from "@/components/layout/AppFooter";
import LocaleSyncer from "@/components/layout/LocaleSyncer";
import { SITE_URL } from "@modparks/core/config";
import { SITE_NAME, canonicalUrl, seoAlternates } from "@/lib/seo/canonical";
import AdSenseLoader from "@/components/ads/AdSenseLoader";

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
      url: canonicalUrl("/", locale),
      siteName: SITE_NAME,
      images: [
        {
          url: SITE_URL + "/icon-512.png",
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
          url: SITE_URL + "/icon-512.png",
          width: 512,
          height: 512,
        },
      ],
    },
    // Google のファビコンは URL 単位でキャッシュされるため、
    // app/favicon.ico の自動出力（?ハッシュ付き）ではなく public の固定URLを使う。
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
        { url: "/icon.svg", type: "image/svg+xml" },
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    alternates: {
      // ページ側で alternates を返すとレイアウトの値は上書きされる。
      // ここはトップページ用の既定値であり、下位ページは自身の seoAlternates() で置き換える。
      ...seoAlternates("/", locale),
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

  // ここで auth() を呼ぶと配下の全ルートが動的描画になり、共有キャッシュにも載せられない。
  // ログイン状態の反映は SessionBootstrap がクライアント側で行う。
  const messages = await getMessages();

  const cookieStore = await cookies();
  const themeMode = (cookieStore.get("theme_mode")?.value as "light" | "dark") || "dark";

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('error', function(event) {
                var error = event.error;
                if (error && (error.name === 'ChunkLoadError' || (error.message && error.message.indexOf('Loading chunk') !== -1))) {
                  event.preventDefault();
                  var now = Date.now();
                  var lastReload = sessionStorage.getItem('chunk_error_reload');
                  if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
                    sessionStorage.setItem('chunk_error_reload', now.toString());
                    window.location.reload();
                  }
                }
              });
            `
          }}
        />
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

      </head>
      <body>
        <PwaRegister />
        <ThemeRegistry initialMode={themeMode}>
          <SessionBootstrap>
            <NextIntlClientProvider messages={pickRootMessages(messages)}>
              <AdSenseLoader />
              <LocaleSyncer />
              <PinProvider>
                <AppLayout>
                  {children}
                  <AppFooter />
                </AppLayout>
              </PinProvider>
            </NextIntlClientProvider>
          </SessionBootstrap>
        </ThemeRegistry>
      </body>
    </html>
  );
}

export default LocaleLayout;
