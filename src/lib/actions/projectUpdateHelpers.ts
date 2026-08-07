import { posts, projectTags, users, userProfiles } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notifyNewProject } from "@/lib/notifications/notify";
import { recordDeletion, buildRecordKey } from "@/lib/backup/tombstone";
import { getServerErrors } from "@/lib/i18n/serverErrors";
import type { Database } from "@/lib/db";

/**
 * updateProject の検証・付随更新。
 *
 * 本体は「検証 → 保存 → 付随更新」の流れだけを見せたいので、
 * 個々の判断（外部URLの形式、slug の重複、タグの入れ替え）はここへ寄せる。
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
  githubRepo: string | null;
  discordWebhookUrl: string | null;
};

/**
 * 外部連携先の URL を検証し、保存する形に正規化する。
 * @returns 不正な場合は該当フィールドのエラー、正常なら正規化済みの値
 */
export async function normalizeExternalLinks(
  githubRepo: string | null | undefined,
  discordWebhookUrl: string | null | undefined,
): Promise<NormalizedLinks | FieldError> {
  const t = await getServerErrors();

  if (discordWebhookUrl) {
    const { isValidDiscordWebhookUrl } = await import("@/lib/notifications/discord");
    if (!isValidDiscordWebhookUrl(discordWebhookUrl)) {
      return { error: { discordWebhookUrl: [t("project.invalidDiscordWebhook")] } };
    }
  }

  let normalizedGithubRepo: string | null = null;
  if (githubRepo) {
    const { normalizeGithubRepo } = await import("@/lib/utils/github");
    normalizedGithubRepo = normalizeGithubRepo(githubRepo);
    if (!normalizedGithubRepo) {
      return { error: { githubRepo: [t("project.invalidGithubRepo")] } };
    }
  }

  return {
    githubRepo: normalizedGithubRepo,
    discordWebhookUrl: discordWebhookUrl || null,
  };
}

/**
 * slug の変更を受け付けてよいか判定する。
 * @returns 重複していればエラー、変更なしなら undefined、変更するなら退避すべき旧 slug
 */
export async function resolveSlugChange(
  db: Database,
  currentSlug: string,
  newSlug: string | undefined,
): Promise<{ previousSlug: string | undefined } | FieldError> {
  if (!newSlug || newSlug === currentSlug) return { previousSlug: undefined };

  const existing = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.kind, "project"), eq(posts.slug, newSlug)))
    .get();

  if (existing) {
    const t = await getServerErrors();
    return { error: { slug: [t("project.slugTaken")] } };
  }
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
  db: Database,
  project: PublishProject,
  newSlug: string,
  newVisibility: string | undefined,
): Promise<void> {
  if (project.visibility !== "draft") return;
  if (newVisibility !== "public" && newVisibility !== "unlisted") return;

  const author = await db
    .select({ displayName: userProfiles.displayName, username: users.name })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(eq(users.id, project.authorId))
    .get();

  const authorName = author?.displayName || author?.username || "";
  await notifyNewProject(db, { ...project, slug: newSlug, title: project.title }, authorName);
}
