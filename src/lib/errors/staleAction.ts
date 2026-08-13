/**
 * デプロイを跨いだ Server Action 呼び出しの判定。
 *
 * 開いたままのタブから送られる action ID は、新しいビルドには存在しない。
 * Next.js はこれを 500 で落とすため、利用者には「操作が壊れた」ようにしか見えない。
 * 実際には再読み込みで直るので、この形の失敗だけは区別して案内する。
 */

/** Next.js が古い action ID を受けたときに出すメッセージの断片 */
const STALE_ACTION_PATTERNS = [
  "Failed to find Server Action",
  "UnrecognizedActionError",
];

/** 例外メッセージを安全に取り出す */
export const errorMessageOf = (err: unknown): string =>
  err instanceof Error ? err.message : typeof err === "string" ? err : "";

/** デプロイ跨ぎ（古いタブからの送信）による失敗か */
export function isStaleServerActionError(err: unknown): boolean {
  const message = errorMessageOf(err);
  return STALE_ACTION_PATTERNS.some((pattern) => message.includes(pattern));
}
