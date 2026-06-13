import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key: keyArray } = await params;
  const key = keyArray.join("/");

  let R2: R2Bucket;
  if (process.env.NODE_ENV === "development" && typeof process !== "undefined" && process.release?.name === "node") {
    const wrangler = await import(/* webpackIgnore: true */ "wrangler");
    const proxy = await wrangler.getPlatformProxy<{ R2: R2Bucket }>();
    R2 = proxy.env.R2;
  } else {
    R2 = (process.env as any).R2;
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
    if (object.httpMetadata?.contentType) {
      headers.set("Content-Type", object.httpMetadata.contentType);
    }
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
