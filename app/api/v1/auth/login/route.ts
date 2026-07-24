import { NextResponse } from "next/server";
import { getDb, getD1 } from "@/lib/db";
import { users, userProfiles, apiKeys } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { comparePassword, validateTotpToken } from "@/lib/services/auth";
import { checkRateLimit } from "@/lib/rate-limit";

const LOGIN_RATE_LIMIT = 10;
const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const body = await request.json() as any;
    const { identifier, password, totpCode } = body;

    if (!identifier || !password) {
      return NextResponse.json({ error: "Identifier and password are required." }, { status: 400 });
    }

    // identifier を含めてキーにすることで、共有IP環境で無関係な利用者を巻き込まない
    const limit = await checkRateLimit("v1-auth-login", LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW_MS, identifier);
    if (!limit.success) {
      return NextResponse.json({ error: "Too many login attempts. Please try again later." }, { status: 429 });
    }

    const d1 = await getD1();
    const db = getDb(d1);

    // email または username でユーザーを検索
    const userResult = await db
      .select({
        id: users.id,
        passwordHash: users.passwordHash,
        twoFactorEnabled: users.twoFactorEnabled,
        twoFactorSecret: users.twoFactorSecret,
      })
      .from(users)
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(or(eq(users.email, identifier), eq(userProfiles.username, identifier)))
      .limit(1);

    if (userResult.length === 0) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    const user = userResult[0];

    if (!user.passwordHash) {
      return NextResponse.json({ error: "Account does not have a password set." }, { status: 401 });
    }

    // パスワードの検証
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    // 2FAの検証
    if (user.twoFactorEnabled) {
      if (!totpCode) {
        return NextResponse.json({ requires_2fa: true }, { status: 401 });
      }

      if (!user.twoFactorSecret) {
        return NextResponse.json({ error: "2FA is enabled but secret is missing." }, { status: 500 });
      }

      const valid = await validateTotpToken(user.twoFactorSecret, totpCode);
      if (!valid) {
        return NextResponse.json({ error: "Invalid 2FA code." }, { status: 401 });
      }
    }

    // 認証成功 -> API キーの発行
    const newApiKey = `sk_mp_${crypto.randomUUID().replace(/-/g, "")}`;
    const keyName = `CLI Login - ${new Date().toISOString().split("T")[0]}`;

    const encoder = new TextEncoder();
    const data = encoder.encode(newApiKey);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedKey = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    await db.insert(apiKeys).values({
      key: hashedKey,
      name: keyName,
      userId: user.id,
    });

    return NextResponse.json({ apiKey: newApiKey });
  } catch (error) {
    console.error("Login Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}