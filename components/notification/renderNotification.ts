import type { Notification } from "@/db/schema";

type Translate = (key: string, values?: Record<string, string>) => string;

export interface RenderedNotification {
  message: string;
  href: string;
}

/**
 * 通知の種別とペイロードから、表示メッセージと遷移先リンクを組み立てる。
 * i18n キーは Notifications.message.<type> に対応する。
 */
export function renderNotification(t: Translate, n: Notification): RenderedNotification {
  const p = (n.payload ?? {}) as Record<string, string>;
  const message = t(`message.${n.type}`, p);
  return { message, href: hrefFor(n.type, p) };
}

function hrefFor(type: string, p: Record<string, string>): string {
  if (type === "follow") return `/profile/${p.actorUsername ?? ""}`;
  // Post 統合により、対象が Project か Idea かは payload.kind で判別する
  if (p.kind === "idea") return `/ideas/${p.slug ?? ""}`;
  return `/projects/${p.slug ?? ""}`;
}
