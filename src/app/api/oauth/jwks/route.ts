/**
 * id_token 検証用の公開鍵（JWKS）。
 */
import { NextResponse } from "next/server";
import { getPublicJwks } from "@/lib/oauth/idToken";

export async function GET() {
  const jwks = await getPublicJwks();
  return NextResponse.json(jwks, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
