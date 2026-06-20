/**
 * ダウンロード数などの数値をロケールに合わせてフォーマットします。
 * 日本語の場合は 1万 以上の場合は「万」を使い、それ未満はカンマ区切り (e.g. 5,600)。
 * 英語の場合は 1K, 1M などのK/Mサフィックスを使用します。
 */
export function formatCompactNumber(n: number, locale: string): string {
  if (locale === "ja") {
    if (n >= 10_000) {
      const man = n / 10_000;
      return `${Number.isInteger(man) ? man : man.toFixed(1)}\u2060万`;
    }
    return new Intl.NumberFormat("ja-JP").format(n);
  } else {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }
}
