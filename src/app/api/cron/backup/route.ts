import { NextResponse } from "next/server";
import { getDb, getD1 } from "@/lib/db";
import { runAutoBackup } from "@/lib/backup/core";
import { checkCronAuth } from "@/lib/cron/auth";
import { describeError } from "@/lib/errors/describe";
import { generateSnapshot } from "@/lib/snapshot/generate";

export const dynamic = "force-dynamic";

/**
 * 自動バックアップの cron エンドポイント。
 *
 * 実際に実行するかどうかはアプリ設定 (autoBackupEnabled) が決めます。
 * 既定は無効なので、有効化するまでこのエンドポイントは何もせずに返ります。
 */
/**
 * スナップショット生成。
 *
 * バックアップと同じデータ源なので後段に置く（D1 の読み取りが 1 回で済み、
 * Cron 枠も増えない）。ただしバックアップの方が重要なので、
 * ここでの失敗をバックアップの結果に伝播させない。
 */
async function runSnapshot(): Promise<{ ok: boolean; detail?: unknown }> {
  try {
    return { ok: true, detail: await generateSnapshot() };
  } catch (error) {
    console.error("[CRON] Snapshot generation failed:", describeError(error));
    return { ok: false };
  }
}

export async function GET(request: Request) {
  try {
    const unauthorized = checkCronAuth(request);
    if (unauthorized) return unauthorized;

    const d1 = await getD1();
    const db = getDb(d1);

    const result = await runAutoBackup(db);
    const snapshot = await runSnapshot();

    if (result.skipped) {
      return NextResponse.json({ success: true, skipped: true, reason: result.reason, snapshot });
    }

    return NextResponse.json({
      success: true,
      skipped: false,
      key: result.key,
      prunedCount: result.pruned?.length ?? 0,
      snapshot,
    });
  } catch (error: any) {
    const reason = describeError(error);
    console.error("[CRON] Auto backup error:", reason);
    return NextResponse.json({ success: false, error: reason }, { status: 500 });
  }
}
