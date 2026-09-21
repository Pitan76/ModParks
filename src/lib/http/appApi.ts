/**
 * /api/app/*（modparks-api）から JSON を取る。
 *
 * ログイン中の本人向けの読み出しは、Server Action ではなくこちらを使う。
 * Server Action の中で auth() がセッション Cookie を書き直すと、Next が画面を
 * 自動で再取得して余計な描画が 1 回走るため（以前はそれが共有 HTML キャッシュと
 * 噛み合ってリロードの無限ループになった）。同一オリジンなので Cookie は自動で付く。
 * @param path /api/app/ から始まるパス
 */
export async function getAppJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);

  return (await res.json()) as T;
}
