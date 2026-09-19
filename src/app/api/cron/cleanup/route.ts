import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { checkCronAuth } from "@/lib/cron/auth";
import { cleanupOldNotifications } from "@modparks/core/services/notificationCleanup";
import { describeError } from "@modparks/core/errors/describe";

export const dynamic = "force-dynamic";

/**
 * 日次の掃除バッチ。今のところ古い通知の削除だけを行う。
 *
 * 1回の実行量には上限があり、消しきれない分は翌日に持ち越す。
 */
export async function GET(request: Request) {
  const unauthorized = checkCronAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const db = await getDatabase();
  const notifications = await cleanupOldNotifications(db);
    return NextResponse.json({ success: true, notifications });
  } catch (error) {
    const reason = describeError(error);
    console.error("[CRON] Cleanup error:", reason);
    return NextResponse.json({ success: false, error: reason }, { status: 500 });
  }
}
