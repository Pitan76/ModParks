/**
 * ピン留め一覧の端末内の控え。
 *
 * PinProvider は全ページに置かれているが、ピン留めの用途は右クリックメニューの
 * ラベル切替と 6 件上限の判定だけ。そのために毎ページサーバへ取りに行くのは過剰なので、
 * 控えが新しいうちは問い合わせない。自分の端末での変更は toggle のたびに書き戻すので
 * すぐ反映される。古くなりうるのは他の端末で変更した分だけで、それも表示が
 * 最大 TTL だけ遅れるに留まる（ピン留めの正否はサーバ側が判定する）。
 */
const STORAGE_KEY = "pins_cache";

/** 他の端末での変更をどれだけ遅れて拾ってよいか */
const TTL_MS = 60 * 60 * 1000;

type Stored = { userId: string; fetchedAt: number; keys: string[] };

/**
 * 控えを読む。別ユーザーのもの・期限切れ・壊れているものは null。
 * @param userId ログイン中のユーザーID。別アカウントの控えを使わないため
 */
export function readPinCache(userId: string): Set<string> | null {
  // ブラウザのストレージは無効化・容量超過などで例外を投げうる（外部I/O境界）
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const stored = JSON.parse(raw) as Stored;
    if (stored.userId !== userId || Date.now() - stored.fetchedAt > TTL_MS) return null;

    return new Set(stored.keys);
  } catch {
    return null;
  }
}

/**
 * 控えを書く。
 * @param fetchedAt サーバから取得した時刻。toggle で書き戻すときは元の取得時刻を保ち、
 *   他の端末での変更を拾う期限を延ばさないようにする
 */
export function writePinCache(userId: string, keys: Set<string>, fetchedAt: number = Date.now()): void {
  try {
    const stored: Stored = { userId, fetchedAt, keys: [...keys] };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // 書けなければ次回サーバから取り直すだけ
  }
}

/** 控えの取得時刻。toggle で書き戻すときに期限を延ばさないために使う */
export function readPinCacheFetchedAt(): number | undefined {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Stored).fetchedAt : undefined;
  } catch {
    return undefined;
  }
}
