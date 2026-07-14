import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getNotifications, getUnreadCount } from "@/lib/queries/notifications";

/** ベル用: 未読件数と最近の通知一覧をセッション認証で返す */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [unreadCount, items] = await Promise.all([
      getUnreadCount(session.user.id),
      getNotifications(session.user.id, 15),
    ]);
    return NextResponse.json({ unreadCount, items });
  } catch (error) {
    console.error("Notifications API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
