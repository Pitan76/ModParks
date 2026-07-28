-- 通知種別の統合。
-- Project / Idea で分かれていた種別を、Post 統合に合わせて 1 つにまとめる。
-- 対象がどちらなのかは payload.kind で判別できるようにする。
--
-- notifications.type は SQLite 上はただの TEXT（CHECK 制約なし）なので、
-- 値の入れ替えだけで済む。

-- 1. コメント通知の統合
UPDATE notifications SET type = 'comment' WHERE type IN ('project_comment', 'idea_comment');
--> statement-breakpoint

-- 2. お気に入り通知の統合（旧「いいね」を含む）
UPDATE notifications SET type = 'favorite' WHERE type IN ('idea_like', 'project_favorite');
--> statement-breakpoint

-- 3. payload に kind を補う。
--    旧 payload は projectSlug / projectName または ideaId / ideaTitle を持っていた。
--    新形式は kind / slug / title に統一する。
UPDATE notifications
SET payload = json_patch(
      payload,
      json_object(
        'kind',  'project',
        'slug',  json_extract(payload, '$.projectSlug'),
        'title', json_extract(payload, '$.projectName')
      )
    )
WHERE json_extract(payload, '$.projectSlug') IS NOT NULL;
--> statement-breakpoint

UPDATE notifications
SET payload = json_patch(
      payload,
      json_object(
        'kind',  'idea',
        'slug',  json_extract(payload, '$.ideaId'),
        'title', json_extract(payload, '$.ideaTitle')
      )
    )
WHERE json_extract(payload, '$.ideaId') IS NOT NULL;
