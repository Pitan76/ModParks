-- 既存DBに保存された相対URL "/api/r2/<key>" を、R2 カスタムドメイン直配信URL
-- "https://files.modparks.pitan76.net/<key>" へ一括置換する一回きりのデータ移行。
--
-- 目的: 過去アップロード分の配信を OpenNext Worker(/api/r2 プロキシ) から外し、
--       R2 エッジ直配信にする（Worker の継続負荷を消す）。
--
-- 安全性:
--   * WHERE ... LIKE '/api/r2/%' で対象を限定（外部URLや既に絶対URLの行は触らない）。
--   * substr(col, 9) は先頭 "/api/r2/"(8文字) を除いた残り = R2キー。前方一致で厳密に置換。
--   * 冪等: 2回流しても LIKE 条件に合致しなくなるので二重置換されない。
--
-- 実行前に必ず件数を確認し、--local で試してから --remote を推奨。

UPDATE project_media
  SET url = 'https://files.modparks.pitan76.net/' || substr(url, 9)
  WHERE url LIKE '/api/r2/%';

UPDATE projects
  SET icon_url = 'https://files.modparks.pitan76.net/' || substr(icon_url, 9)
  WHERE icon_url LIKE '/api/r2/%';

UPDATE versions
  SET file_url = 'https://files.modparks.pitan76.net/' || substr(file_url, 9)
  WHERE file_url LIKE '/api/r2/%';

UPDATE user_profiles
  SET avatar_url = 'https://files.modparks.pitan76.net/' || substr(avatar_url, 9)
  WHERE avatar_url LIKE '/api/r2/%';

UPDATE users
  SET image = 'https://files.modparks.pitan76.net/' || substr(image, 9)
  WHERE image LIKE '/api/r2/%';

UPDATE collections
  SET icon_url = 'https://files.modparks.pitan76.net/' || substr(icon_url, 9)
  WHERE icon_url LIKE '/api/r2/%';

UPDATE platforms
  SET icon_url = 'https://files.modparks.pitan76.net/' || substr(icon_url, 9)
  WHERE icon_url LIKE '/api/r2/%';
