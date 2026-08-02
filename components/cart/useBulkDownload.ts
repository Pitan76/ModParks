"use client";

import { buildProjectDownloadUrl } from "@/lib/utils/downloadUrl";
import type { CartItem } from "./cartStore";

/** ブラウザへの負荷を抑えるため、リクエストの間に置く待ち時間(ms) */
const DOWNLOAD_INTERVAL_MS = 300;

export interface BulkDownloadFilter {
  loader: string;
  mcVersion: string;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function triggerDownload(url: string): void {
  // iframe は CSP の frame-src に阻まれるため、<a download> のクリックで開始する
  const a = document.createElement("a");
  a.href = url;
  a.download = "";
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * カート内の全アイテムを順次ダウンロードする。
 * @param onDownloaded 全件の開始後に呼ばれる。履歴への記録などに使う
 */
export function useBulkDownload(
  items: CartItem[],
  filter: BulkDownloadFilter,
  onDownloaded: (items: CartItem[], filter: BulkDownloadFilter) => void,
) {
  return async function downloadAll(): Promise<void> {
    const pref = {
      loaders:    filter.loader ? [filter.loader] : undefined,
      mcVersions: filter.mcVersion ? [filter.mcVersion] : undefined,
    };

    for (const item of items) {
      triggerDownload(buildProjectDownloadUrl(item.slug, pref));
      await wait(DOWNLOAD_INTERVAL_MS);
    }

    onDownloaded(items, filter);
  };
}
