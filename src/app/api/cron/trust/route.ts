import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { checkCronAuth } from "@/lib/cron/auth";
import { syncTrustForActiveUsers } from "@modparks/core/services/trustAttributes";
import { syncVersionCleanCredits } from "@modparks/core/services/trustActivity";
import { recomputeStaleTrust } from "@modparks/core/services/trust";
import { notifyStalledReports } from "@modparks/core/services/trustReportQueue";
import { getAdminWebhookUrl } from "@/lib/usage/webhook";
import { describeError } from "@modparks/core/errors/describe";

export const dynamic = "force-dynamic";

/** スコアは減衰で動くため、イベントがなくても 1 日 1 回は作り直す */
const STALE_HOURS = 24;

/**
 * 信頼ポイントの日次バッチ。
 *
 * 加点は「起きた瞬間に積む」のではなく、ここで現在の状態を見て足りない分を積む。
 * 記録は冪等なので、実行が飛んでも次回に自動で埋まる。
 */
export async function GET(request: Request) {
  const unauthorized = checkCronAuth(request);
  if (unauthorized) return unauthorized;

  const db = await getDatabase();

  try {
    const users = await syncTrustForActiveUsers(db);
    const versionsCredited = await syncVersionCleanCredits(db);

    const staleBefore = new Date(Date.now() - STALE_HOURS * 3600_000);
    const recomputed = await recomputeStaleTrust(db, staleBefore);

    // 判断は人間に残すため、キューが放置されていないかをここで見る
    const stalledReports = await notifyStalledReports(db, await getAdminWebhookUrl());

    return NextResponse.json({ success: true, users, versionsCredited, recomputed, stalledReports });
  } catch (error) {
    const reason = describeError(error);
    console.error("[CRON] Trust sync error:", reason);
    return NextResponse.json({ success: false, error: reason }, { status: 500 });
  }
}
