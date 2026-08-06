/**
 * トークン失効エンドポイント（RFC 7009）。
 * 存在しないトークンでも 200 を返すのが仕様なので、成否は呼び出し元に伝えない。
 */
import { NextResponse } from "next/server";
import { authenticateClient, findClient, readClientCredentials } from "@/lib/oauth/clients";
import { tokenError } from "@/lib/oauth/errors";
import { revokeToken } from "@/lib/oauth/tokens";

export async function POST(request: Request) {
  const form = new URLSearchParams(await request.text());
  const { clientId, clientSecret } = readClientCredentials(request, form);

  const client = await findClient(clientId);
  if (!client) return tokenError("invalid_client", "Unknown or disabled client_id");
  if (!(await authenticateClient(client, clientSecret))) return tokenError("invalid_client", "Client authentication failed");

  const token = form.get("token");
  if (!token) return tokenError("invalid_request", "token is required");

  await revokeToken(token, client.id);
  return new NextResponse(null, { status: 200 });
}
