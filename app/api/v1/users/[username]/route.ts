import { NextResponse } from "next/server";
import { getDb, getD1 } from "@/lib/db";
import { users, userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ApiUser } from "@/types/api";

export async function GET(_request: Request, { params }: { params: Promise<{ username: string }> }) {
  const d1 = await getD1();
  const db = getDb(d1);



  const { username } = await params;

  const [user] = await db
    .select({
      username: userProfiles.username,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
      bio: userProfiles.bio,
      githubUsername: userProfiles.githubUsername,
    })
    .from(users)
    .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(eq(userProfiles.username, username))
    .limit(1);

  if (!user || !user.username) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const data: ApiUser = {
    username: user.username,
    displayName: user.displayName || null,
    avatarUrl: user.avatarUrl || null,
    bio: user.bio || null,
    githubUsername: user.githubUsername || null,
  };

  return NextResponse.json({ data });
}
