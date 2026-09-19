import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { users } from "@modparks/core/db/schema";
import { eq } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { isTrustedBrowserRequest } from "@/lib/auth/trustedDevice";

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 10 * 60 * 1000;

/**
 * ログインフォームが 2FA 入力欄を出すべきかを判定する。
 *
 * 存在しないメールアドレスでも 200 / twoFactorEnabled:false を返す。
 * 404 を返すとアカウントの存在有無が外部から列挙できてしまうため。
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string };
    const email = body.email;
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const limit = await checkRateLimit("auth-check-2fa", RATE_LIMIT, RATE_WINDOW_MS, email);
    if (!limit.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const db = await getDatabase();
    const user = await db.select({ id: users.id, twoFactorEnabled: users.twoFactorEnabled }).from(users).where(eq(users.email, email)).get();
    if (!user?.twoFactorEnabled) return NextResponse.json({ twoFactorEnabled: false });

    // 記憶済みのブラウザには入力欄自体を出さない（実際の省略判定はログイン側でも行う）
    const trusted = await isTrustedBrowserRequest(db, user.id);
    return NextResponse.json({ twoFactorEnabled: !trusted });
  } catch (error) {
    console.error("check-2fa error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
