import { getMyPins } from "@/lib/actions/profilePins";

/**
 * ログイン中の本人がピン留めしている項目。
 *
 * PinProvider は全ページのマウント時にこれを読む。以前は Server Action を
 * 直接呼んでいたが、Server Action の中の auth() はセッション Cookie を
 * 書き直す（有効期限を延ばすため）。Cookie を書いた Server Action の後は
 * Next が画面を自動で再取得（RSC）するので、ログイン中は全ページ表示のたびに
 * 余計な描画が 1 回走っていた。さらに共有 HTML キャッシュが古いビルドの HTML を
 * 返していると、再取得で得た新しいビルドとの食い違いから全体の読み直しに
 * 入り、それが無限に繰り返された。
 *
 * GET のルートハンドラなら Cookie を書いても画面の再取得は起きない。
 */
export async function GET() {
  return Response.json(await getMyPins(), { headers: { "Cache-Control": "private, no-store" } });
}
