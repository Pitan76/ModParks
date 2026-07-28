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
--> statement-breakpoint

-- 4. アイコンのキー名も統一する（projectIconUrl → iconUrl）。
--    Idea には元々アイコンが無いため、対象は Project 由来の通知のみ。
UPDATE notifications
SET payload = json_remove(
      json_patch(payload, json_object('iconUrl', json_extract(payload, '$.projectIconUrl'))),
      '$.projectIconUrl'
    )
WHERE json_extract(payload, '$.projectIconUrl') IS NOT NULL;
--> statement-breakpoint

-- 5. 統合前のキーを落とす。旧キーが残ると、表示側でどちらを見るべきか曖昧になる。
UPDATE notifications
SET payload = json_remove(payload, '$.projectSlug', '$.projectName', '$.ideaId', '$.ideaTitle')
WHERE json_extract(payload, '$.projectSlug') IS NOT NULL
   OR json_extract(payload, '$.ideaId') IS NOT NULL;
--> statement-breakpoint

-- 6. ユーザーの通知ON/OFF設定（user_settings.notification_prefs）のキーも統合する。
--
--    このキーは NOTIFICATION_TYPES と対応しており、移行しないと
--    「ユーザーが明示的にOFFにした設定」が消えて通知が復活する。
--
--    2つの設定を1つに統合するため、値が食い違う場合の扱いを決める必要がある。
--    ここでは「どちらか一方でもOFFなら、統合後もOFF」とする。
--    ユーザーが通知を減らす操作をした意図を優先し、望まない通知が復活する事態を避ける。
--    必要な通知が届かなくなった場合は設定画面から戻せる（逆は気づきにくい）。
UPDATE user_settings
SET notification_prefs = json_patch(
      notification_prefs,
      json_object('comment', json(
        CASE WHEN json_extract(notification_prefs, '$.project_comment') = 0
               OR json_extract(notification_prefs, '$.idea_comment') = 0
             THEN 'false' ELSE 'true' END))
    )
WHERE notification_prefs IS NOT NULL
  AND (json_extract(notification_prefs, '$.project_comment') IS NOT NULL
    OR json_extract(notification_prefs, '$.idea_comment') IS NOT NULL);
--> statement-breakpoint

UPDATE user_settings
SET notification_prefs = json_patch(
      notification_prefs,
      json_object('favorite', json(
        CASE WHEN json_extract(notification_prefs, '$.project_favorite') = 0
               OR json_extract(notification_prefs, '$.idea_like') = 0
             THEN 'false' ELSE 'true' END))
    )
WHERE notification_prefs IS NOT NULL
  AND (json_extract(notification_prefs, '$.project_favorite') IS NOT NULL
    OR json_extract(notification_prefs, '$.idea_like') IS NOT NULL);
--> statement-breakpoint

UPDATE user_settings
SET notification_prefs = json_remove(
      notification_prefs,
      '$.project_comment', '$.idea_comment', '$.project_favorite', '$.idea_like'
    )
WHERE notification_prefs IS NOT NULL;
