import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { pushSubscriptions } from "@/db/schema";
import { and, eq } from "drizzle-orm";

/** ランタイム env（wrangler [vars]）から VAPID 公開鍵を取得する。dev は wrangler proxy 経由。 */
async function getVapidPublicKey(): Promise<string | undefined> {
  let key = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (key) return key;
  try {
    if (process.env.NODE_ENV === "development" && process.release?.name === "node") {
      const { getCachedPlatformProxy } = await import("@/lib/proxy");
      const env = (await getCachedPlatformProxy()).env as unknown as Record<string, string | undefined>;
      key = env.VAPID_PUBLIC_KEY;
    } else {
      const { getCloudflareContext } = await import("@opennextjs/cloudflare");
      const env = (await getCloudflareContext({ async: true })).env as unknown as Record<string, string | undefined>;
      key = env.VAPID_PUBLIC_KEY;
    }
  } catch {
    /* ignore */
  }
  return key;
}

/**
 * VAPID 公開鍵を返す（クライアントの購読に必要）。
 * NEXT_PUBLIC_* はビルド時埋め込みが必要で wrangler [vars]（ランタイム）と噛み合わないため、
 * クライアントはビルド時定数ではなく実行時にこのエンドポイントから鍵を取得する。
 * 公開鍵なので認証不要。
 */
export async function GET() {
  const vapidPublicKey = await getVapidPublicKey();
  if (!vapidPublicKey) {
    return NextResponse.json({ error: "Push not configured" }, { status: 503 });
  }
  return NextResponse.json({ vapidPublicKey });
}

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
