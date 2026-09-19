import type { Session } from "next-auth";
import { ADMIN_ROLE } from "@modparks/core/auth/roles";

export { ADMIN_ROLE, isAdminUser } from "@modparks/core/auth/roles";

/**
 * セッション上のロールで管理者かを判定する。
 *
 * session.user.role は types/next-auth.d.ts の型拡張で生えるため、
 * この判定は Next 側にしか置けない。
 *
 * role は JWT に載った発行時点の値なので、DB 側で降格しても再ログインまで
 * 反映されない。取り消しの効かない操作では isAdminUser を使うこと。
 */
export const isAdminSession = (session: Session | null | undefined): boolean =>
  session?.user?.role === ADMIN_ROLE;
