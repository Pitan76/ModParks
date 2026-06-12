import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import ThemeRegistry from "@/components/ThemeRegistry";
import Box from "@mui/material/Box";
import { auth } from "@/lib/auth";
import AppHeader from "@/components/layout/AppHeader";
import AppFooter from "@/components/layout/AppFooter";

export const metadata: Metadata = {
  title: {
    default: "ModParks — Minecraft Mod & Plugin Platform",
    template: "%s | ModParks",
  },
  description:
    "Minecraft Java Edition向けのMod・Pluginを簡単に公開・検索・ダウンロードできる日本発プラットフォーム",
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

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <ThemeRegistry>
          <NextIntlClientProvider messages={messages}>
            <Box
              sx={{
                minHeight:     "100vh",
                display:       "flex",
                flexDirection: "column",
                bgcolor:       "background.default",
              }}
            >
              <AppHeader session={session} />
              <Box component="main" sx={{ flex: 1 }}>
                {children}
              </Box>
              <AppFooter />
            </Box>
          </NextIntlClientProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
