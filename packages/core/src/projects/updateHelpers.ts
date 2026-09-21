import { posts, projectTags, users, userProfiles } from "@modparks/core/db/schema";
import { eq, and } from "drizzle-orm";
import { recordDeletion, buildRecordKey } from "@modparks/core/backup/tombstone";
import { notifyNewProject, type NotifyContext } from "@modparks/core/notifications/dispatch";
import type { ServerErrorTranslator } from "@modparks/core/i18n/serverErrors";
import type { Database } from "@modparks/core/db/client";

/**
 * updateProject の検証・付随更新。
 *
 * 本体は「検証 → 保存 → 付随更新」の流れだけを見せたいので、
 * 個々の判断（外部URLの形式、slug の重複、タグの入れ替え）はここへ寄せる。
 *
 * エラー文言の翻訳関数と通知の送り手は環境から作るものなので受け取る。
 */

export type PublishProject = {
  slug: string;
  title: string;
  iconUrl: string | null;
  authorId: string;
  visibility: string;
};

/** フィールド単位のエラー。そのまま Server Action の戻り値にできる形 */
type FieldError = { error: Record<string, string[]> };

export type NormalizedLinks = {
  githubRepo: string | null | undefined;
  discordWebhookUrl: string | null | undefined;
};

/**
 * 外部連携先の URL を検証し、保存する形に正規化する。
 *
 * 未送信（undefined）はそのまま undefined を返す。null に潰すと、
 * その項目を持たない画面から保存しただけで既存値が消えてしまうため。
 * @returns 不正な場合は該当フィールドのエラー、正常なら正規化済みの値
 */
export async function normalizeExternalLinks(
  t: ServerErrorTranslator,
  githubRepo: string | null | undefined,
  discordWebhookUrl: string | null | undefined,
): Promise<NormalizedLinks | FieldError> {
  if (discordWebhookUrl) {
    const { isValidDiscordWebhookUrl } = await import("@modparks/core/notifications/discord");
    if (!isValidDiscordWebhookUrl(discordWebhookUrl)) {
      return { error: { discordWebhookUrl: [t("project.invalidDiscordWebhook")] } };
    }
  }

  let normalizedGithubRepo: string | null | undefined = githubRepo === undefined ? undefined : null;
  if (githubRepo) {
    const { normalizeGithubRepo } = await import("@modparks/core/utils/github");
    normalizedGithubRepo = normalizeGithubRepo(githubRepo);
    if (!normalizedGithubRepo) {
      return { error: { githubRepo: [t("project.invalidGithubRepo")] } };
    }
  }

  return {
    githubRepo: normalizedGithubRepo,
    discordWebhookUrl: discordWebhookUrl === undefined ? undefined : discordWebhookUrl || null,
  };
}

/**
 * slug の変更を受け付けてよいか判定する。
 * @returns 重複していればエラー、変更なしなら undefined、変更するなら退避すべき旧 slug
 */
export async function resolveSlugChange(
  db: Database,
  t: ServerErrorTranslator,
  currentSlug: string,
  newSlug: string | undefined,
): Promise<{ previousSlug: string | undefined } | FieldError> {
  if (!newSlug || newSlug === currentSlug) return { previousSlug: undefined };

  const existing = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.kind, "project"), eq(posts.slug, newSlug)))
    .get();

  if (existing) return { error: { slug: [t("project.slugTaken")] } };

  return { previousSlug: currentSlug };
}

/**
 * タグを渡された内容へ入れ替える。
 * 差分を取らず全消し＋再投入にしているのは、順序も含めて指定どおりにするため。
 */
export async function syncProjectTags(db: Database, projectId: string, tags: string[]): Promise<void> {
  const previousTags = await db
    .select({ tag: projectTags.tag })
    .from(projectTags)
    .where(eq(projectTags.projectId, projectId))
    .all();

  await db.delete(projectTags).where(eq(projectTags.projectId, projectId)).run();

  await recordDeletion(
    db,
    "project_tags",
    previousTags.map((t: { tag: string }) => buildRecordKey(projectId, t.tag)),
  );

  if (tags.length > 0) {
    await db.insert(projectTags).values(tags.map((tag) => ({ projectId, tag }))).run();
  }
}

/** 下書き→公開の初回公開時のみ、作者フォロワーへ新プロジェクト通知を送る */
export async function maybeNotifyPublish(
  ctx: NotifyContext,
  project: PublishProject,
  newSlug: string,
  newVisibility: string | undefined,
): Promise<void> {
  if (project.visibility !== "draft") return;
  if (newVisibility !== "public" && newVisibility !== "unlisted") return;

  const author = await ctx.db
    .select({ displayName: userProfiles.displayName, username: users.name })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(eq(users.id, project.authorId))
    .get();

  const authorName = author?.displayName || author?.username || "";
  await notifyNewProject(ctx, { ...project, slug: newSlug, title: project.title }, authorName);
}
