import { type NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Env } from "@/lib/db";
import { safeContentTypeForKey } from "@/lib/upload/fileTypes";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key: keyArray } = await params;
  const key = keyArray.join("/");

  // M-1: Only allow specific prefixes for public access
  const allowedPrefixes = ["avatar/", "icon/", "mod/"];
  const isAllowed = allowedPrefixes.some(prefix => key.startsWith(prefix));
  if (!isAllowed) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let R2: R2Bucket;
  if (process.env.NODE_ENV === "development" && typeof process !== "undefined" && process.release?.name === "node") {
    const { getCachedPlatformProxy } = await import("@/lib/proxy");
    const proxy = await getCachedPlatformProxy();
    R2 = proxy.env.modparks_storage;
  } else {
    const { env } = await getCloudflareContext({ async: true });
    R2 = (env as unknown as Env).modparks_storage;
  }

  if (!R2) {
    return new NextResponse("R2 binding not found", { status: 500 });
  }

  try {
    const object = await R2.get(key);
    if (!object) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const headers = new Headers();
    // 保存済みの Content-Type はアップロード時にクライアントが指定した値なので信用しない。
    // そのまま返すと `text/html` を保存するだけで自オリジン上の HTML として描画され、
    // CSP が script-src 'unsafe-inline' を許している以上スクリプトが実行される。
    // 画像として安全に返せる拡張子のみ本来の型を付け、それ以外は必ずダウンロード扱いにする。
    const contentType = safeContentTypeForKey(key);
    if (contentType) {
      headers.set("Content-Type", contentType);
    } else {
      headers.set("Content-Type", "application/octet-stream");
      headers.set("Content-Disposition", "attachment");
    }
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("etag", object.httpEtag);


    // R2オブジェクトの body は ReadableStream なのでそのまま返せる
    return new NextResponse(object.body as any, {
      headers,
    });
  } catch (err) {
    console.error("Failed to fetch from R2:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
