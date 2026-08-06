ALTER TABLE `versions` ADD `uploader_id` text REFERENCES users(id);--> statement-breakpoint
CREATE INDEX `versions_uploader_idx` ON `versions` (`uploader_id`);--> statement-breakpoint
-- 既存行には実行者の記録がないため、プロジェクトの投稿者で埋める。
-- 共同管理プロジェクトでは実際の実行者と食い違いうるが、
-- 遡って特定する手段がないので、判明している中で最も近い値を入れる。
UPDATE `versions`
SET `uploader_id` = (
  SELECT `posts`.`author_id`
  FROM `posts`
  WHERE `posts`.`id` = `versions`.`project_id`
)
WHERE `uploader_id` IS NULL;