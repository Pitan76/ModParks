import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./lib/i18n/routing";

// Cloudflare Workers (OpenNext) では NextAuth の auth() ラッパーが
// 非同期初期化のため proxy エクスポートとして機能しないため、
// i18n ルーティングのみを proxy で処理し、
// 認証チェックはページ/レイアウト側で行う
// そのためproxy.tsにすると壊れるためmiddleware.tsのままにしなければならない
const handleI18nRouting = createMiddleware(routing);

const DEFAULT_LOCALE_PREFIX = `/${routing.defaultLocale}`;

/** `/ja` および `/ja/...`（既定ロケールの接頭辞つきURL）かどうか */
const isDefaultLocalePrefixed = (pathname: string): boolean =>
  pathname === DEFAULT_LOCALE_PREFIX || pathname.startsWith(`${DEFAULT_LOCALE_PREFIX}/`);

/**
 * 既定ロケール(ja)は接頭辞なしが正のため、`/ja/...` を踏む古い被リンクは
 * next-intl の一時リダイレクト(307)ではなく 301 で恒久的に寄せ、リンク評価を引き継ぐ。
 */
export function middleware(request: NextRequest) {
  const response = handleI18nRouting(request);

  const location = response.headers.get("location");
  if (!location || !isDefaultLocalePrefixed(request.nextUrl.pathname)) return response;

  return NextResponse.redirect(new URL(location, request.url), 301);
}

export const config = {
  matcher: ['/((?!api|archive|\\.well-known|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|xml|txt|webmanifest|js|json)$).*)'],
};
