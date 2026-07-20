import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/auth-helpers";
import { getR2Bucket } from "@/lib/r2";

export async function GET(req: NextRequest) {
  try {
    // 管理者権限の検証（未認証・非管理者の場合は Forbidden / Unauthorized をスロー）
    await getAdminDb();

    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");

    // snapshot/ は復元直前に自動取得される切り戻し用データ。
    // 管理者が復元前に手元へ退避できるよう、ダウンロードを許可します。
    if (!key || !(key.startsWith("backup/") || key.startsWith("snapshot/"))) {
      return NextResponse.json({ error: "Invalid key" }, { status: 400 });
    }

    const bucket = await getR2Bucket();
    const obj = await bucket.get(key);

    if (!obj) {
      return NextResponse.json({ error: "Backup file not found" }, { status: 404 });
    }

    const jsonStr = await obj.text();
    const filename = key.split("/").pop() || "backup.json";

    return new NextResponse(jsonStr, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    let status = 500;
    if (error.message === "Forbidden") status = 403;
    if (error.message === "Unauthorized") status = 401;

    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
