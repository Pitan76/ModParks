"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";
import { locales, usePathname, useRouter } from "@/lib/i18n/routing";
import type { AppLocale } from "@/lib/i18n/routing";

interface LocaleSyncerProps {
  userLocale: string;
}

/**
 * ログインユーザーの設定言語と、URLから決まる現在の言語が食い違う場合に、
 * 設定言語のURL（既定ロケール以外は `/en/...` のような接頭辞付き）へ寄せる。
 *
 * localePrefix が "as-needed" になりURLがロケールの正になったため、
 * Cookie の書き換えでは言語が切り替わらない。
 */
export default function LocaleSyncer({ userLocale }: LocaleSyncerProps) {
  const currentLocale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!userLocale || userLocale === currentLocale) return;
    // 未対応の値で遷移すると 404 と再試行のループになるため弾く
    if (!locales.includes(userLocale as AppLocale)) return;
    router.replace(pathname, { locale: userLocale as AppLocale });
  }, [userLocale, currentLocale, pathname, router]);

  return null;
}
