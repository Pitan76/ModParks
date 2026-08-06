/**
 * Cloudflare 実測値の取得結果を KV に残す。
 *
 * 取得は Cron 実行の中で起きるため、失敗しても管理画面には何も届かない。
 * 「トークン未設定かもしれない」以上のことが分からないと切り分けができないので、
 * 最後の試行の結果だけを残して管理画面から読めるようにする。
 */
import { getSettingsKV } from "@/lib/kv";

const STATUS_KEY = "usage:analytics-status";

/** 失敗の種別。管理画面ではこれをそのまま翻訳キーに使う */
export type AnalyticsFailureKind =
  | "envUnavailable"
  | "missingAccountId"
  | "missingToken"
  | "graphqlErrors"
  | "httpError"
  | "networkError";

export type AnalyticsFailure = {
  kind: AnalyticsFailureKind;
  /** API が返した本文やエラーメッセージ。原文のまま残す */
  detail?: string;
  /** HTTP 応答があった場合のみ */
  status?: number;
};

/** 最後の試行の結果 */
export type AnalyticsStatus = {
  /** 試行時刻 (epoch ms) */
  at: number;
  failure?: AnalyticsFailure;
};

/** detail が長すぎると KV も画面も無駄に太るため頭だけ残す */
const MAX_DETAIL = 500;

export function truncateDetail(detail: string): string {
  if (detail.length <= MAX_DETAIL) return detail;
  return `${detail.slice(0, MAX_DETAIL)}…`;
}

/** 外部 I/O 境界。診断情報の保存に失敗しても集計そのものは止めない */
export async function writeAnalyticsStatus(failure?: AnalyticsFailure): Promise<void> {
  const status: AnalyticsStatus = { at: Date.now(), ...(failure ? { failure } : {}) };
  try {
    const kv = await getSettingsKV();
    await kv.put(STATUS_KEY, JSON.stringify(status));
  } catch (error) {
    console.error("[USAGE] Failed to persist analytics status:", error);
  }
}

/** 外部 I/O 境界。読めなければ「診断情報なし」として扱えば足りる */
export async function readAnalyticsStatus(): Promise<AnalyticsStatus | null> {
  try {
    const kv = await getSettingsKV();
    return (await kv.get(STATUS_KEY, "json")) as AnalyticsStatus | null;
  } catch (error) {
    console.error("[USAGE] Failed to read analytics status:", error);
    return null;
  }
}
