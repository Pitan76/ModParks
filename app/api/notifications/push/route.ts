import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { pushSubscriptions } from "@/db/schema";
import { and, eq } from "drizzle-orm";

/** クライアントの PushManager 購読を保存/更新する（同一 endpoint は upsert） */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const endpoint = body.endpoint;
  const p256dh = body.keys?.p256dh;
  const authKey = body.keys?.auth;
  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  try {
    const db = await getDatabase();
    // endpoint は unique。既存なら所有者/鍵を更新する（別ユーザーの端末使い回し対策も兼ねる）。
    await db
      .insert(pushSubscriptions)
      .values({ userId: session.user.id, endpoint, p256dh, auth: authKey })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId: session.user.id, p256dh, auth: authKey },
      })
      .run();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Push subscribe error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** 購読を解除する（endpoint 指定）。本人の購読のみ削除できる。 */
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.endpoint) {
    return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  }

  try {
    const db = await getDatabase();
    await db
      .delete(pushSubscriptions)
      .where(and(
        eq(pushSubscriptions.userId, session.user.id),
        eq(pushSubscriptions.endpoint, body.endpoint),
      ))
      .run();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Push unsubscribe error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
