-- Post 統合フェーズ2: 既存データを posts / comments / favorites へ移す。
--
-- このマイグレーションはデータの移動のみを行い、旧テーブルには手を触れない。
-- 旧カラム・旧テーブルの削除はフェーズ3（後続のマイグレーション）で行う。
--
-- ID の衝突について:
--   projects.id と ideas.id、project_comments.id と idea_comments.id は
--   これまで別々のキー空間だったものを 1 つに合流させる。衝突があれば
--   主キー制約でこのマイグレーションが失敗する。INSERT OR IGNORE は使わない。
--   黙って取りこぼすより、失敗して気づくほうがよい。

-- 1. projects → posts
INSERT INTO posts (
  id, author_id, kind, slug, previous_slug,
  title, body, body_format, visibility, created_at, updated_at
)
SELECT
  id, author_id, 'project', slug, previous_slug,
  name, description, description_format, status, created_at, updated_at
FROM projects;
--> statement-breakpoint

-- 2. ideas → posts
--    Idea は slug を持たないため、id をそのまま入れる。
--    これにより既存の /ideas/{id} という URL がそのまま解決できる。
INSERT INTO posts (
  id, author_id, kind, slug, previous_slug,
  title, body, body_format, visibility, created_at, updated_at
)
SELECT
  id, author_id, 'idea', id, NULL,
  title, content, content_format, visibility, created_at, updated_at
FROM ideas;
--> statement-breakpoint

-- 3. project_comments → comments
INSERT INTO comments (
  id, post_id, parent_id, author_id, content, content_format, created_at, updated_at
)
SELECT
  id, project_id, parent_id, author_id, content, content_format, created_at, updated_at
FROM project_comments;
--> statement-breakpoint

-- 4. idea_comments → comments
INSERT INTO comments (
  id, post_id, parent_id, author_id, content, content_format, created_at, updated_at
)
SELECT
  id, idea_id, parent_id, author_id, content, content_format, created_at, updated_at
FROM idea_comments;
--> statement-breakpoint

-- 5. project_favorites → favorites
INSERT INTO favorites (post_id, user_id, created_at)
SELECT project_id, user_id, created_at FROM project_favorites;
--> statement-breakpoint

-- 6. idea_likes → favorites
--    idea_likes には created_at カラムが無いため、現在時刻で補う。
INSERT INTO favorites (post_id, user_id, created_at)
SELECT idea_id, user_id, unixepoch() FROM idea_likes;
