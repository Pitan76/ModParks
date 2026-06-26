import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Cloudflare Workers (OpenNext) では NextAuth の auth() ラッパーが
// 非同期初期化のため proxy エクスポートとして機能しないため、
// i18n ルーティングのみを proxy で処理し、
// 認証チェックはページ/レイアウト側で行う
// そのためproxy.tsにすると壊れるためmiddleware.tsのままにしなければならない
export const middleware = createMiddleware(routing);

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|xml|txt)$).*)'],
};
