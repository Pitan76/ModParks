/**
 * R2 上のバックアップを読み、パースして返す。
 *
 * 認可をしないので、必ず管理者の確認を済ませた処理からだけ呼ぶこと。
 * 以前は "use server" のファイルから export されており、外部から任意の key を
 * 渡して直接呼べる公開エンドポイントになっていた。ファイル名は
 * backup/backup_<ミリ秒>.json で、毎日 03:00 UTC に作られるため総当たりで
 * 当てられ、暗号化対象外の表（非公開の投稿・コレクション・通報など）を
 * 誰でも読めてしまう状態だった。
 */
export const loadBackupFromR2 = async (key: string) => {
  if (!key.startsWith("backup/") && !key.startsWith("snapshot/")) {
    throw new Error("Invalid backup key");
  }

  const { getR2Bucket } = await import("@/lib/r2");
  const bucket = await getR2Bucket();
  const obj = await bucket.get(key);
  if (!obj) throw new Error("Backup file not found in R2");

  return JSON.parse(await obj.text());
};
