// 公開・非個人化データ向けのCDNキャッシュ指定。
// エッジで60秒キャッシュし、その後300秒は古い値を返しつつ裏で再検証する
export const PUBLIC_CACHE = "public, s-maxage=60, stale-while-revalidate=300";

// レスポンスにキャッシュ用ヘッダを付与して返す
export function withPublicCache<T extends Response>(res: T, value: string = PUBLIC_CACHE): T {
  res.headers.set("Cache-Control", value);
  return res;
}
