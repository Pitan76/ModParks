import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadToR2 } from "@/lib/r2";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Env } from "@/lib/db";

/** PUT /api/upload/direct
 * 開発環境向けの R2 への直接アップロードエンドポイント
 * (本番環境ではS3互換のPresigned URLを返す設計の場合、このエンドポイントは不要ですが、
 * Cloudflare Workers R2バインディングではPresigned URL発行が複雑なため、
 * ワーカー経由で直接ファイルをPUTするエンドポイントとしても利用されます)
 */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  let R2: R2Bucket;
  if (process.env.NODE_ENV === "development" && typeof process !== "undefined" && process.release?.name === "node") {
    // 開発環境のWrangler Proxy経由でR2を取得
    const { getCachedPlatformProxy } = await import("@/lib/proxy");
    const proxy = await getCachedPlatformProxy();
    R2 = proxy.env.modparks_storage;
  } else {
    // Edgeランタイム / 本番環境
    const { env } = await getCloudflareContext({ async: true });
    R2 = (env as unknown as Env).modparks_storage;
  }

  if (!R2) {
    return NextResponse.json({ error: "R2 binding not found" }, { status: 500 });
  }

  try {
    const contentType = req.headers.get("content-type") || "application/octet-stream";
    const body = await req.arrayBuffer();
    
    if (!body || body.byteLength === 0) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    await uploadToR2(R2, key, body, contentType);

    return NextResponse.json({ success: true, key });
  } catch (err: any) {
    console.error("Upload Error:", err);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
