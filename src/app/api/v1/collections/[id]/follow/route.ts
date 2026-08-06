import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { collectionFollows, collections } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { recordDeletion, buildRecordKey } from "@/lib/backup/tombstone";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const db = await getDatabase();

    const collection = await db.select().from(collections).where(eq(collections.id, id)).get();
    if (!collection) return NextResponse.json({ error: "Collection not found" }, { status: 404 });

    if (collection.userId === session.user.id) {
      return NextResponse.json({ error: "Cannot follow your own list" }, { status: 400 });
    }

    const existing = await db.select().from(collectionFollows).where(and(eq(collectionFollows.userId, session.user.id), eq(collectionFollows.collectionId, id))).get();
    if (existing) return NextResponse.json({ success: true });

    await db.insert(collectionFollows).values({
      userId: session.user.id,
      collectionId: id,
    }).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const db = await getDatabase();

    await db.delete(collectionFollows).where(and(eq(collectionFollows.userId, session.user.id), eq(collectionFollows.collectionId, id))).run();
    await recordDeletion(db, "collection_follows", buildRecordKey(session.user.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
