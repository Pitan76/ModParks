/**
 * 例外を 1 行の文字列に潰す。
 *
 * Workers のログでは console.error(error) がスタックしか出さないことがあり、
 * さらに Drizzle は D1 の例外を DrizzleQueryError で包むため、
 * 本当の理由（no such table など）が cause の奥に隠れる。
 * 原因の連鎖と発行した SQL まで含めて出す。
 */

/** cause を辿る上限。循環や過剰な深さで無限に伸びるのを防ぐ */
const MAX_DEPTH = 5;

type DrizzleLike = { query?: unknown; params?: unknown };

function describeOne(error: unknown): string {
  if (!(error instanceof Error)) return String(error);

  const { query } = error as Error & DrizzleLike;
  const head = `${error.name}: ${error.message}`;
  return typeof query === "string" ? `${head} [sql: ${query}]` : head;
}

/**
 * 例外と、その原因の連鎖を読める形にする。
 *
 * @param error catch した値。Error でなくてもよい
 */
export function describeError(error: unknown): string {
  const parts: string[] = [];

  let current: unknown = error;
  for (let depth = 0; depth < MAX_DEPTH && current != null; depth += 1) {
    parts.push(describeOne(current));
    if (!(current instanceof Error)) break;
    current = current.cause;
  }

  return parts.join(" <- caused by ");
}
