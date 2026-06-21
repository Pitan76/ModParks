import { NextResponse } from "next/server";
import { getDb, getD1 } from "@/lib/db";
import { users, userProfiles, apiKeys } from "@/db/schema";
import { eq, or, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { TOTP } from "otpauth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { identifier, password, totpCode } = body;

    if (!identifier || !password) {
      return NextResponse.json({ error: "Identifier and password are required." }, { status: 400 });
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
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
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

      const totp = new TOTP({
        issuer: "ModParks",
        label: identifier,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: user.twoFactorSecret,
      });

      const delta = totp.validate({ token: totpCode, window: 1 });
      if (delta === null) {
        return NextResponse.json({ error: "Invalid 2FA code." }, { status: 401 });
      }
    }

    // 認証成功 -> API キーの発行
    const newApiKey = `sk_mp_${crypto.randomUUID().replace(/-/g, "")}`;
    const keyName = `CLI Login - ${new Date().toISOString().split("T")[0]}`;

    await db.insert(apiKeys).values({
      key: newApiKey,
      name: keyName,
      userId: user.id,
    });

    return NextResponse.json({ apiKey: newApiKey });
  } catch (error) {
    console.error("Login Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}