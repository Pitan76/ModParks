import { NextResponse } from "next/server";
import { getDb, getD1 } from "@/lib/db";
import { ideas, users, userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ApiIdea } from "@/types/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const d1 = await getD1();
  const db = getDb(d1);

  const { id } = await params;

  const [result] = await db
    .select({
      id: ideas.id,
      title: ideas.title,
      content: ideas.content,
      status: ideas.status,
      createdAt: ideas.createdAt,
      updatedAt: ideas.updatedAt,
      author: {
        username: userProfiles.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
      },
    })
    .from(ideas)
    .leftJoin(users, eq(ideas.authorId, users.id))
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(eq(ideas.id, id))
    .limit(1);

  if (!result) {
    return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  }

  const data: ApiIdea = {
    id: result.id,
    title: result.title,
    content: result.content,
    status: result.status as "open" | "in_progress" | "fulfilled",
    createdAt: result.createdAt ? new Date(result.createdAt).getTime() : 0,
    updatedAt: result.updatedAt ? new Date(result.updatedAt).getTime() : 0,
    author: {
      username: result.author?.username || "unknown",
      displayName: result.author?.displayName || null,
      avatarUrl: result.author?.avatarUrl || null,
    },
  };

  return NextResponse.json({ data });
}