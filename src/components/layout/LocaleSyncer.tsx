"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";
import { locales, usePathname, useRouter } from "@/lib/i18n/routing";
import type { AppLocale } from "@/lib/i18n/routing";
import { isUnprefixedRoute } from "@/lib/i18n/unprefixedRoutes";
import { storeLocaleCookie } from "@/lib/i18n/localeCookie";

interface LocaleSyncerProps {
  userLocale: string;
}

/**
 * ログインユーザーの設定言語を、現在の表示言語に反映させる。
 *
 * 公開ページはURLが言語の正なので設定言語のURLへ移動し、
 * 接頭辞なしルート（設定・管理画面など）はCookieが正なので更新して再取得する。
 */
export default function LocaleSyncer({ userLocale }: LocaleSyncerProps) {
  const currentLocale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!userLocale || userLocale === currentLocale) return;
    // 未対応の値で遷移すると 404 と再試行のループになるため弾く
    if (!locales.includes(userLocale as AppLocale)) return;

    storeLocaleCookie(userLocale);

    if (isUnprefixedRoute(pathname)) {
      router.refresh();
      return;
    }
    router.replace(pathname, { locale: userLocale as AppLocale });
  }, [userLocale, currentLocale, pathname, router]);

  return null;
}
