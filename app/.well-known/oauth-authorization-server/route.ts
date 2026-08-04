/**
 * RFC 8414 の認可サーバーメタデータ。内容は OIDC ディスカバリと同一。
 */
import { NextResponse } from "next/server";
import { buildAuthorizationServerMetadata } from "@/lib/oauth/metadata";

export async function GET() {
  return NextResponse.json(buildAuthorizationServerMetadata(), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
