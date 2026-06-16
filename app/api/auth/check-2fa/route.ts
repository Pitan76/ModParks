import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string };
    const email = body.email;
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const db = await getDatabase();
    const user = await db.select({ twoFactorEnabled: users.twoFactorEnabled }).from(users).where(eq(users.email, email)).get();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ twoFactorEnabled: !!user.twoFactorEnabled });
  } catch (error) {
    console.error("check-2fa error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
