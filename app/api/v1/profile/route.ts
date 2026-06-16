import { NextResponse } from "next/server";
import { getDb, getD1 } from "@/lib/db";
import { users } from "@/db/schema";
import { validateApiKey } from "@/lib/api-auth";
import { eq } from "drizzle-orm";

export async function PUT(request: Request) {
  const d1 = await getD1();
  const db = getDb(d1);

  // APIキー検証
  const auth = await validateApiKey(request);
  if (!auth.valid || !auth.userId) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
  }

  try {
    const { updateProfileSchema } = await import("@/lib/validations");
    const body = await request.json();
    
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation Error", details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    
    const { displayName, bio } = parsed.data;

    const updates: Partial<typeof users.$inferInsert> = {};
    if (displayName !== undefined) updates.displayName = displayName;
    if (bio !== undefined) updates.bio = bio;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    await db.update(users).set(updates).where(eq(users.id, auth.userId));

    return NextResponse.json({ success: true, updated: updates });
  } catch (error) {
    console.error("Profile API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
