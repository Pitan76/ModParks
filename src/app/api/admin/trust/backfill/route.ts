import { NextResponse } from "next/server";
import { getAdminDb, getReauthenticatedAdminDb } from "@/lib/auth-helpers";
import { backfillTrust } from "@/lib/services/trustBackfill";
import { describeError } from "@modparks/core/errors/describe";

export const dynamic = "force-dynamic";

type BackfillBody = {
  /** 既定は true。実際に書き込むには明示的に false を渡す */
  dryRun?: boolean;
  /** 本実行にのみ必要 */
  totpToken?: string;
};

/**
 * 信頼ポイントの遡及投入。導入時に 1 度だけ実行する。
 *
 * 既定は dry-run で、段階の分布を返すだけで台帳には何も書かない。
 * 本実行は多数のユーザのスコアを一斉に動かすため、TOTP による再認証を要求する。
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as BackfillBody;
    const dryRun = body.dryRun !== false;

    // どちらの経路でも認可のうえで db を返すため、ここで受け取って引き回す
    const { db } = dryRun
      ? await getAdminDb()
      : await getReauthenticatedAdminDb(body.totpToken ?? "");

    const report = await backfillTrust(db, { dryRun });
    return NextResponse.json({ success: true, ...report });
  } catch (error) {
    const reason = describeError(error);
    console.error("[TRUST] Backfill error:", reason);

    const status = reason === "Forbidden" ? 403 : 500;
    return NextResponse.json({ success: false, error: reason }, { status });
  }
}
