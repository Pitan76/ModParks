import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing, locales, type AppLocale } from "./lib/i18n/routing";
import { isUnprefixedRoute } from "./lib/i18n/unprefixedRoutes";
import { LOCALE_COOKIE } from "./lib/i18n/localeCookie";

// Cloudflare Workers (OpenNext) では NextAuth の auth() ラッパーが
// 非同期初期化のため proxy エクスポートとして機能しないため、
// i18n ルーティングのみを proxy で処理し、
// 認証チェックはページ/レイアウト側で行う
// そのためproxy.tsにすると壊れるためmiddleware.tsのままにしなければならない
const handleI18nRouting = createMiddleware(routing);

/** `/en/foo` を { locale, pathname: "/foo" } に分解する。接頭辞が無ければ locale は null */
function splitLocalePrefix(pathname: string): { locale: AppLocale | null; pathname: string } {
  for (const locale of locales) {
    if (pathname === `/${locale}`) return { locale, pathname: "/" };
    if (pathname.startsWith(`/${locale}/`)) return { locale, pathname: pathname.slice(locale.length + 1) };
  }
  return { locale: null, pathname };
}

/** 表示言語をCookieに残す。接頭辞なしルートはこのCookieだけが言語の手がかりになる */
function rememberLocale(response: NextResponse, locale: AppLocale): NextResponse {
  response.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return response;
}

function readLocale(request: NextRequest): AppLocale {
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookie && locales.includes(cookie as AppLocale)) return cookie as AppLocale;
  return routing.defaultLocale;
}

/**
 * 公開ページはURLで言語を分け（SEO）、非公開ページは接頭辞なしURLに統一してCookieで言語を決める。
 *
 * next-intl の localePrefix はアプリ全体に一律でしかかけられないため、
 * 接頭辞なしルートの分だけここで前処理する。
 */
export function middleware(request: NextRequest) {
  const { locale: prefix, pathname } = splitLocalePrefix(request.nextUrl.pathname);

  if (isUnprefixedRoute(pathname)) {
    // `/en/settings` のような接頭辞つきURLは接頭辞なしへ寄せる。
    // 言語はここで確定しているので、そのままCookieに残して転送先で使う
    if (prefix) {
      const url = request.nextUrl.clone();
      url.pathname = pathname;
      return rememberLocale(NextResponse.redirect(url, 307), prefix);
    }

    const locale = readLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  const response = handleI18nRouting(request);

  // 既定ロケール(ja)は接頭辞なしが正のため、`/ja/...` を踏む古い被リンクは
  // next-intl の一時リダイレクト(307)ではなく 301 で恒久的に寄せ、リンク評価を引き継ぐ
  if (prefix === routing.defaultLocale && response.headers.get("location")) {
    const location = response.headers.get("location")!;
    return rememberLocale(NextResponse.redirect(new URL(location, request.url), 301), routing.defaultLocale);
  }

  // 公開ページはURLが言語の正。次に接頭辞なしルートへ移ったときのためにCookieへ写しておく
  return rememberLocale(response, prefix ?? routing.defaultLocale);
}

export const config = {
  matcher: ['/((?!api|archive|\\.well-known|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|xml|txt|webmanifest|js|json)$).*)'],
};
