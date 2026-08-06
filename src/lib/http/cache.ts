import { NextResponse } from "next/server";

// 公開・非個人化データ向けのCDNキャッシュ指定。
// エッジで60秒キャッシュし、その後300秒は古い値を返しつつ裏で再検証する
export const PUBLIC_CACHE = "public, s-maxage=60, stale-while-revalidate=300";

// レスポンスにキャッシュ用ヘッダを付与して返す
export function withPublicCache(res: NextResponse, value: string = PUBLIC_CACHE): NextResponse {
  res.headers.set("Cache-Control", value);
  return res;
}
