// プロフィールのピン留めに関する定数・型。
// Server Action ファイル（"use server"）は async 関数しか値エクスポートできないため、
// クライアント/サーバー双方から使う定数・型はこの通常モジュールに置く。

/** 1 ユーザーがピン留めできる最大件数 */
export const MAX_PINS = 6;

export type PinItemType = "project" | "idea";
export type PinRef = { itemType: PinItemType; itemId: string };
