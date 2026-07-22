import { getTranslations } from "next-intl/server";

/**
 * Server Action からユーザー向けエラーメッセージを取得する。
 * ロケールはリクエストコンテキスト（middleware が設定したもの）から解決される。
 */
export const getServerErrors = () => getTranslations("ServerErrors");
