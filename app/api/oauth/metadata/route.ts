/**
 * 認可サーバーのメタデータ本体。
 *
 * 公開URLは /.well-known/openid-configuration と /.well-known/oauth-authorization-server で、
 * next.config.ts の rewrites からここへ流している。
 * app/ 直下にドット始まりのディレクトリを置くとビルドが解決できないため、この形にしている。
 */
import { NextResponse } from "next/server";
import { buildAuthorizationServerMetadata } from "@/lib/oauth/metadata";

export async function GET() {
  return NextResponse.json(buildAuthorizationServerMetadata(), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
