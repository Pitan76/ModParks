import { NextResponse } from "next/server";
import { getDb, getD1 } from "@/lib/db";
import { runAutoBackup } from "@/lib/backup/core";

export const dynamic = "force-dynamic";

/**
 * 自動バックアップの cron エンドポイント。
 *
 * 実際に実行するかどうかはアプリ設定 (autoBackupEnabled) が決めます。
 * 既定は無効なので、有効化するまでこのエンドポイントは何もせずに返ります。
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const d1 = await getD1();
    const db = getDb(d1);

    const result = await runAutoBackup(db);

    if (result.skipped) {
      return NextResponse.json({ success: true, skipped: true, reason: result.reason });
    }

    return NextResponse.json({
      success: true,
      skipped: false,
      key: result.key,
      prunedCount: result.pruned?.length ?? 0,
    });
  } catch (error: any) {
    console.error("[CRON] Auto backup error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
