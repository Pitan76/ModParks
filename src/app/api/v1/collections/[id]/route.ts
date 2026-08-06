import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { collections } from "@/db/schema";
import { eq } from "drizzle-orm";
import { recordDeletion } from "@/lib/backup/tombstone";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDatabase();
    const { id } = await params;
    const body = await request.json();
    const { name, description, visibility, iconUrl } = body as {
      name: string;
      description: string;
      visibility: string;
      iconUrl: string;
    };

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const targetCollection = await db.query.collections.findFirst({
      where: eq(collections.id, id),
    });

    if (!targetCollection) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (targetCollection.userId !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db
      .update(collections)
      .set({
        name,
        description,
        visibility,
        iconUrl,
        updatedAt: new Date(),
      })
      .where(eq(collections.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating collection:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDatabase();
    const { id } = await params;

    const targetCollection = await db.query.collections.findFirst({
      where: eq(collections.id, id),
    });

    if (!targetCollection) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (targetCollection.userId !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.delete(collections).where(eq(collections.id, id));
    await recordDeletion(db, "collections", id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting collection:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
