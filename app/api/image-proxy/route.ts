import { NextResponse } from "next/server";

/**
 * 外部画像のプロキシ。
 *
 * 投稿本文（Markdown）に書かれた外部画像を、閲覧者のブラウザから直接取得させると、
 * 画像ホスト側に閲覧者の IP アドレス・User-Agent・Referer が渡る。
 * `![](https://webhook.site/...)` のような「受信確認サービス」への画像リンクを
 * 本文に仕込むだけで、閲覧者を追跡できてしまう（実際に本番で確認された）。
 *
 * ここを経由させることで、外部ホストから見えるのは Worker のアドレスだけになり、
 * 閲覧者の情報は渡らない。
 *
 * 画像そのものをブロックしないのは、README バッジ（img.shields.io）など
 * 正当な用途があるため。追跡を防ぎつつ表示は保つのが狙い。
 */

/** 取得を許可しないホスト。内部ネットワークへの到達（SSRF）を防ぐ */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
  "metadata.google.internal",
]);

/** プライベート/リンクローカルアドレスの判定 */
function isPrivateAddress(hostname: string): boolean {
  if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) return true;

  // IPv4 のプライベート・ループバック・リンクローカル
  const v4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // クラウドのメタデータ endpoint
    return false;
  }

  // IPv6 のループバック・ユニークローカル・リンクローカル
  const v6 = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80")) {
    return true;
  }
  return false;
}

/** 転送してよいレスポンスか（画像であること）を確認する */
function isImageContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  return contentType.split(";")[0].trim().toLowerCase().startsWith("image/");
}

/** SVG はスクリプトを埋め込めるため、扱いを分ける必要がある */
function isSvg(contentType: string): boolean {
  return contentType.split(";")[0].trim().toLowerCase() === "image/svg+xml";
}

/** 取得する画像の上限。Worker のメモリを圧迫しない範囲に収める */
const MAX_BYTES = 10 * 1024 * 1024;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (target.protocol !== "https:") {
    return NextResponse.json({ error: "Only https is allowed" }, { status: 400 });
  }
  if (isPrivateAddress(target.hostname)) {
    return NextResponse.json({ error: "Forbidden host" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      // 閲覧者の情報を一切渡さない。Referer も送らない
      headers: { Accept: "image/*" },
      referrerPolicy: "no-referrer",
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json({ error: "Upstream error" }, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type");
  if (!isImageContentType(contentType)) {
    return NextResponse.json({ error: "Not an image" }, { status: 415 });
  }

  const length = Number(upstream.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large" }, { status: 413 });
  }

  const body = await upstream.arrayBuffer();
  if (body.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large" }, { status: 413 });
  }

  const headers: Record<string, string> = {
    "Content-Type": contentType!,
    // 外部への再リクエストを減らすため長めにキャッシュする
    "Cache-Control": "public, max-age=86400, s-maxage=604800",
    "X-Content-Type-Options": "nosniff",
    // プロキシした画像から更に外部への読み込みやスクリプト実行が起きないようにする
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  };

  // SVG は <img> 経由なら script が動かないが、URL を直接開かれると
  // 自サイトのオリジンでスクリプトが実行されうる。
  // ダウンロード扱いにしてブラウザに描画させない（<img> での表示には影響しない）。
  // shields.io のバッジなど、正当な用途で SVG が使われるため拒否はしない。
  if (isSvg(contentType!)) {
    headers["Content-Disposition"] = "attachment";
  }

  return new NextResponse(body, { headers });
}
