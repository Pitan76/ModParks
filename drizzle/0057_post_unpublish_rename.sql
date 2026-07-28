-- モデレーション監査ログの action 名を統合に合わせて改名する。
--
-- Post 統合により、非公開化は Project 専用の操作ではなくなった
-- （Idea も posts.visibility で同じ経路を通る）ため project_unpublish は実態と合わない。
--
-- moderation_audit.action は SQLite 上はただの TEXT（CHECK 制約なし）なので値の入れ替えだけで済む。
UPDATE moderation_audit SET action = 'post_unpublish' WHERE action = 'project_unpublish';
