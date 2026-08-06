/**
 * Server Action の戻り値の共通形。
 *
 * error は「表示可能な文言」を入れる。Server Action はリクエストのロケールを
 * 解決できるので、翻訳は getServerErrors() でサーバ側に閉じ、
 * 呼び出し側（クライアント）は受け取った文字列をそのまま出せばよい。
 * 翻訳キーをそのまま返すと、受け側ごとに解決の仕方がばらつくため避ける。
 *
 * フォームのフィールド単位のエラーは形が違う（{ [field]: string[] }）ので
 * ActionFieldErrors を使う。
 */

/** データを伴わない成功、または表示用エラー */
export type ActionResult<T = undefined> =
  | ({ success: true } & (T extends undefined ? object : { data: T }))
  | { error: string };

/** zod の flatten().fieldErrors をそのまま返す形。フォームのフィールド下に出す */
export type ActionFieldErrors = { error: Record<string, string[]> };

/** ActionResult が失敗かどうかの絞り込み */
export const isActionError = <T>(result: ActionResult<T>): result is { error: string } =>
  "error" in result;
