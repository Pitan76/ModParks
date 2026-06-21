import { NextResponse } from "next/server";
import { getDb, getD1 } from "@/lib/db";
import { users, userProfiles } from "@/db/schema";
import { validateApiKey } from "@/lib/api-auth";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const d1 = await getD1();
  const db = getDb(d1);

  const auth = await validateApiKey(request);
  if (!auth.valid || !auth.userId) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
  }

  const [userRecord] = await db
    .select({
      id: users.id,
      role: users.role,
      username: userProfiles.username,
      displayName: userProfiles.displayName,
    })
    .from(users)
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(eq(users.id, auth.userId))
    .limit(1);

  if (!userRecord) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: {
      id: userRecord.id,
      role: userRecord.role,
      username: userRecord.username,
      displayName: userRecord.displayName,
    }
  });
}
