import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getNotifications, getUnreadCount } from "@/lib/queries/notifications";
import { checkRateLimit } from "@/lib/rate-limit";

// ユーザー単位の上限。通常の画面遷移では当たらないが、暴走ループ等を頭打ちにする
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

/** ベル用: 未読件数と最近の通知一覧をセッション認証で返す */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 認証済みユーザーIDを subject にして、ユーザーごとにレート制限する
  const limit = await checkRateLimit("notifications-get", RATE_LIMIT, RATE_WINDOW_MS, session.user.id);
  if (!limit.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
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
