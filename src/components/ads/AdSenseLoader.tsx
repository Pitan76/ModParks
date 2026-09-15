"use client";

import Script from "next/script";
import { useSession } from "next-auth/react";
import { getAdsMode, getAdsenseClient } from "@/lib/config/ads";

/**
 * AdSense の本体スクリプトをページで一度だけ読み込む。
 *
 * プレミアムかどうかで出し分けるが、その判定をサーバで行うと HTML が
 * ログイン状態に依存し、共有キャッシュに載せられなくなる。
 * 読み込みは描画後で間に合うため、ここはクライアントで判定する。
 */
const AdSenseLoader = () => {
  const { data: session, status } = useSession();

  if (status === "loading") return null;
  if (getAdsMode() !== "on") return null;
  if (session?.user?.isPremium) return null;

  const client = getAdsenseClient();
  if (!client) return null;

  return (
    <Script
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
};

export default AdSenseLoader;
