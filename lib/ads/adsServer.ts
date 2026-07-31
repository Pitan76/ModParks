import { auth } from "@/lib/auth";

/**
 * 閲覧者に対して広告を出さないべきか（＝広告非表示の特典が効いているか）を判定する。
 *
 * 現状の対象はプレミアムユーザーのみ。判定は `auth()` のセッション（jwt コールバックが
 * 5分TTLでDBから更新）を見るため、付与・取り消しは最大5分で反映される。
 *
 * 広告関連の設定値 (`lib/config/ads.ts`) はクライアントからも参照するため、
 * 認証に依存するこの判定だけをサーバー専用モジュールに分けている。
 */
export async function isAdFreeViewer(): Promise<boolean> {
  try {
    const session = await auth();
    return !!session?.user?.isPremium;
  } catch (e: unknown) {
    // セッション取得に失敗しても広告表示は継続する（収益側にフェイルセーフ）
    console.error("Failed to resolve ad-free status", e);
    return false;
  }
}
