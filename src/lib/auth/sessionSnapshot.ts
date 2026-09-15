import type { Session } from "next-auth";

/**
 * ヘッダー描画用のセッション控え。
 *
 * ページ HTML をセッション非依存にすると、ログイン状態は描画後にしか分からない。
 * 毎回 /api/auth/session を取りに行くと Next.js 本体のロードが走ってしまうため、
 * 前回の内容をブラウザに残して初期表示に使う。
 *
 * 認可には決して使わないこと。閲覧者が自由に書き換えられる値であり、
 * 権限判定はサーバ側の auth() だけが行う。ここにあるのは見た目のための情報に限る。
 */

const STORAGE_KEY = "mp_session_snapshot";

/** 控えの有効期間(ms)。これを過ぎたら描画に使わず取り直させる */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

type Snapshot = {
  session: Session;
  savedAt: number;
};

/**
 * 控えを読む。無い・壊れている・古い場合は undefined。
 *
 * undefined を返すと SessionProvider が自分で取得しに行く。null ではなく
 * undefined なのは、null が「未ログインと確定した」を意味するため。
 */
export function readSessionSnapshot(): Session | undefined {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;

    const snapshot = JSON.parse(raw) as Snapshot;
    if (!snapshot?.session || Date.now() - snapshot.savedAt > MAX_AGE_MS) return undefined;

    return snapshot.session;
  } catch {
    return undefined;
  }
}

/** 取得できたセッションを控えに残す。未ログインなら控えごと消す */
export function writeSessionSnapshot(session: Session | null): void {
  try {
    if (!session) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ session, savedAt: Date.now() } satisfies Snapshot));
  } catch {
    // 保存できなくても描画は続けられる。プライベートウィンドウ等で起きる
  }
}
