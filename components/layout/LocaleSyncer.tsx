"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";

interface LocaleSyncerProps {
  userLocale: string;
}

/**
 * ログインユーザーの設定言語（userLocale）と、現在のCookie/ブラウザからの判定言語（currentLocale）
 * が一致しない場合、Cookieを強制的に上書きしてリロードするコンポーネント。
 */
export default function LocaleSyncer({ userLocale }: LocaleSyncerProps) {
  const currentLocale = useLocale();
  const router = useRouter();

  useEffect(() => {
    if (userLocale && userLocale !== currentLocale) {
      // NEXT_LOCALE クッキーを上書き (1年間有効)
      document.cookie = `NEXT_LOCALE=${userLocale}; path=/; max-age=31536000`;
      // Cookieを上書きした後、再読み込みして言語を反映させる
      window.location.reload();
    }
  }, [userLocale, currentLocale]);

  return null;
}
