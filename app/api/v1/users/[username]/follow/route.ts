import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { userFollows, userProfiles } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: Request, { params }: { params: Promise<{ username: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { username } = await params;
    const db = await getDatabase();

    const targetProfile = await db.select().from(userProfiles).where(eq(userProfiles.username, username)).get();
    if (!targetProfile) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (targetProfile.userId === session.user.id) {
      return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
    }

    const existing = await db.select().from(userFollows).where(and(eq(userFollows.followerId, session.user.id), eq(userFollows.followingId, targetProfile.userId))).get();
    if (existing) return NextResponse.json({ success: true });

    await db.insert(userFollows).values({
      followerId: session.user.id,
      followingId: targetProfile.userId,
    }).run();

    const actorProfile = await db
      .select({ username: userProfiles.username, displayName: userProfiles.displayName })
      .from(userProfiles)
      .where(eq(userProfiles.userId, session.user.id))
      .get();
    const { notifyToUser } = await import("@/lib/notifications/notify");
    await notifyToUser(db, targetProfile.userId, session.user.id, "follow", {
      actorUsername: actorProfile?.username ?? "",
      actorName: actorProfile?.displayName || actorProfile?.username || "",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ username: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { username } = await params;
    const db = await getDatabase();

    const targetProfile = await db.select().from(userProfiles).where(eq(userProfiles.username, username)).get();
    if (!targetProfile) return NextResponse.json({ error: "User not found" }, { status: 404 });

    await db.delete(userFollows).where(and(eq(userFollows.followerId, session.user.id), eq(userFollows.followingId, targetProfile.userId))).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
