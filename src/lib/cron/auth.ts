import { NextResponse } from "next/server";

/**
 * cron エンドポイントの認証。
 *
 * 呼び出し元は worker-wrapper.js の scheduled ハンドラで、
 * `Authorization: Bearer ${env.CRON_SECRET}` を付けて自分自身を fetch する。
 *
 * 以前は `if (process.env.CRON_SECRET && ...)` という条件だったため、
 * シークレットが未設定・あるいは実行環境で読めない場合に
 * 認証なしで誰でも実行できる状態（fail-open）になっていた。
 * バックアップ生成や外部API同期を外部から叩けるため、
 * 設定されていない場合は実行しない（fail-closed）ようにする。
 *
 * @returns 認証NGなら返すべきレスポンス。OKなら null
 */
export function checkCronAuth(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[CRON] CRON_SECRET is not configured; refusing to run.");
    return new NextResponse("Cron secret not configured", { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  return null;
}
