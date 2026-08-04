/**
 * OIDC のディスカバリ文書。
 * 「ModParks でログイン」を実装する側は、この1本を読めば残りの URL を自動で引ける。
 */
import { NextResponse } from "next/server";
import { buildAuthorizationServerMetadata } from "@/lib/oauth/metadata";

export async function GET() {
  return NextResponse.json(buildAuthorizationServerMetadata(), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
