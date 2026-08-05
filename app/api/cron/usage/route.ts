import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cron/auth";
import { rollupSliceIncrements } from "@/lib/usage/sliceRollup";
import { expireModeIfDue } from "@/lib/runtime/mode";

export const dynamic = "force-dynamic";

/**
 * スライス集計の取り込み。
 *
 * ddos_slices は 30 分で削除されるため、毎時の実行では取りこぼす。
 * 保持期間より短い 10 分間隔で増分だけを積む。
 */
export async function GET(request: Request) {
  const unauthorized = checkCronAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const requests = await rollupSliceIncrements();
    // 戻し忘れで止まったままにならないよう、期限切れをここで後始末する
    const modeRestored = await expireModeIfDue();

    return NextResponse.json({ success: true, requests, modeRestored });
  } catch (error) {
    console.error("[CRON] Usage rollup error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
