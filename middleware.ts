import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { auth } from "./lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const intlMiddleware = createMiddleware(routing);

/** 認証が必要なパスパターン */
const PROTECTED_PATTERNS = [
  /^\/[a-z]{2}\/projects\/new/,
  /^\/[a-z]{2}\/projects\/[^/]+\/edit/,
  /^\/[a-z]{2}\/projects\/[^/]+\/versions\/new/,
  /^\/[a-z]{2}\/profile/,
  /^\/[a-z]{2}\/admin/,
];

/** 管理者のみのパスパターン */
const ADMIN_PATTERNS = [/^\/[a-z]{2}\/admin/];

export default auth(async (req: NextRequest & { auth: { user?: { role?: string } } | null }) => {
  const { pathname } = req.nextUrl;

  // 認証チェック
  const isProtected = PROTECTED_PATTERNS.some((p) => p.test(pathname));
  if (isProtected && !req.auth) {
    const loginUrl = new URL(`/api/auth/signin`, req.url);
    loginUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(loginUrl);
  }

  // 管理者チェック
  const isAdmin = ADMIN_PATTERNS.some((p) => p.test(pathname));
  if (isAdmin && req.auth?.user?.role !== "admin") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
