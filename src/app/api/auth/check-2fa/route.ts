import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";

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
    const user = await db.select({ twoFactorEnabled: users.twoFactorEnabled }).from(users).where(eq(users.email, email)).get();

    return NextResponse.json({ twoFactorEnabled: !!user?.twoFactorEnabled });
  } catch (error) {
    console.error("check-2fa error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
