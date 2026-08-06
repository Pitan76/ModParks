/**
 * UserInfo エンドポイント。Bearer アクセストークンで本人情報を返す。
 */
import { NextResponse } from "next/server";
import { requireBearerScope } from "@/lib/oauth/bearer";
import { buildUserClaims } from "@/lib/oauth/userClaims";
import { bearerError } from "@/lib/oauth/errors";

export async function GET(request: Request) {
  const auth = await requireBearerScope(request, "profile:read");
  if (!auth.ok) return auth.response;

  const claims = await buildUserClaims(auth.token.userId, auth.token.scopes);
  if (!claims) return bearerError("invalid_token", "User not found");

  return NextResponse.json(claims, { headers: { "Cache-Control": "no-store" } });
}
