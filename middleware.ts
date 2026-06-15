import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Cloudflare Workers (OpenNext) では NextAuth の auth() ラッパーが
// 非同期初期化のため middleware エクスポートとして機能しないため、
// i18n ルーティングのみをミドルウェアで処理し、
// 認証チェックはページ/レイアウト側で行う
export const middleware = createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)" ],
};
