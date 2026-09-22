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

/**
 * /api/app/*（modparks-api）の変更系を呼ぶ。
 *
 * 本文は Server Action の戻り値と同じ形で返ってくるので、200（成功）と 422（処理した
 * 結果としての失敗）はどちらも結果として返す。画面側は Server Action を呼んでいた頃と
 * 同じように戻り値を扱えばよい。未ログイン・機能停止・サーバの障害などは例外にする
 * （Server Action が例外で伝えていたものに相当）。
 *
 * エラー文言をこのページの言語で返してもらうため、<html lang> を添える
 * （API の URL には言語が無いため）。
 * @param body FormData ならそのまま、オブジェクトなら JSON で送る
 */
export async function sendAppAction<T>(path: string, method: "POST" | "PATCH" | "DELETE", body?: FormData | object): Promise<T> {
  const headers: Record<string, string> = { "X-MP-Locale": document.documentElement.lang };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(path, { method, headers, body: payload });
  if (!res.ok && res.status !== 422) throw new Error(`${method} ${path} returned ${res.status}`);

  return (await res.json()) as T;
}
