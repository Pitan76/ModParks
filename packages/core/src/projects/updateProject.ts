import { eq } from "drizzle-orm";
import type { Database } from "@modparks/core/db/client";
import { posts, projects } from "@modparks/core/db/schema";
import { findProjectPostById } from "@modparks/core/queries/post";
import { updateProjectSchema } from "@modparks/core/validations";
import { FormReader } from "@modparks/core/forms/formReader";
import { buildProjectUpdateInput } from "@modparks/core/forms/projectFormInput";
import { detectSourceLocale } from "@modparks/core/translation/detectLocale";
import { canEditProject } from "@modparks/core/projects/access";
import { normalizeExternalLinks, resolveSlugChange, syncProjectTags, maybeNotifyPublish } from "@modparks/core/projects/updateHelpers";
import type { ServerErrorTranslator } from "@modparks/core/i18n/serverErrors";
import type { NotifyContext } from "@modparks/core/notifications/dispatch";

/**
 * プロジェクトの基本情報を更新する本体。
 *
 * Next の Server Action と modparks-api の両方から呼ぶ。結果は例外ではなく
 * データで返す。Server Action は「見つからない・権限なし」を例外で伝える契約で、
 * API は HTTP ステータスで伝えるため、どちらにも変換できる形にしている。
 *
 * キャッシュの無効化はしない。Next は revalidatePath、modparks-api は HTML
 * キャッシュの削除と手段が違うので、影響を受けた slug を返して呼び出し側に任せる。
 */
export type UpdateProjectDeps = {
  notify: NotifyContext;
  t: ServerErrorTranslator;
};

export type UpdateProjectOutcome =
  | { type: "saved"; slug: string; previousSlug: string | undefined }
  | { type: "invalid"; error: Record<string, string[] | undefined> }
  | { type: "notFound" }
  | { type: "forbidden" };

export async function updateProject(
  deps: UpdateProjectDeps,
  projectId: string,
  formData: FormData,
  userId: string,
): Promise<UpdateProjectOutcome> {
  const { db } = deps.notify;
  const project = await findProjectPostById(db, projectId);
  if (!project) return { type: "notFound" };
  if (!(await canEditProject(db, project, userId))) return { type: "forbidden" };

  const form = new FormReader(formData);
  const parsed = updateProjectSchema.safeParse(buildProjectUpdateInput(formData));
  if (!parsed.success) return { type: "invalid", error: parsed.error.flatten().fieldErrors };

  const { tags, githubRepo, discordWebhookUrl, ...fields } = parsed.data;

  const links = await normalizeExternalLinks(deps.t, githubRepo, discordWebhookUrl);
  if ("error" in links) return { type: "invalid", error: links.error };

  const slugChange = await resolveSlugChange(db, deps.t, project.slug, fields.slug);
  if ("error" in slugChange) return { type: "invalid", error: slugChange.error };

  await saveProject(db, project, fields, links, form, slugChange.previousSlug);

  if (tags !== undefined) await syncProjectTags(db, project.id, tags);

  const slug = fields.slug ?? project.slug;
  await maybeNotifyPublish(deps.notify, project, slug, fields.status);

  return { type: "saved", slug, previousSlug: slugChange.previousSlug };
}

type Project = NonNullable<Awaited<ReturnType<typeof findProjectPostById>>>;
type Fields = Omit<ReturnType<typeof updateProjectSchema.parse>, "tags" | "githubRepo" | "discordWebhookUrl">;
type Links = { githubRepo: string | null | undefined; discordWebhookUrl: string | null | undefined };

/**
 * 共通カラムは posts、Project 固有のカラムは projects へ書く。
 * 2 つの UPDATE がちぐはぐな状態で残らないよう batch でまとめる。
 */
async function saveProject(
  db: Database,
  project: Project,
  fields: Fields,
  links: Links,
  form: FormReader,
  previousSlug: string | undefined,
): Promise<void> {
  // posts へ書く項目と、残り（= projects のカラム）に分ける
  const { name, description, descriptionFormat, status, sourceLocale, ...projectFields } = fields;
  const postFields = { name, description, descriptionFormat, status, sourceLocale, slug: fields.slug };

  await db.batch([
    db.update(posts).set(buildPostChanges(project, postFields, previousSlug)).where(eq(posts.id, project.id)),
    db.update(projects).set(buildProjectChanges(projectFields, links, form)).where(eq(projects.id, project.id)),
  ]);
}

type PostFields = Pick<Fields, "name" | "description" | "descriptionFormat" | "status" | "sourceLocale" | "slug">;
type ProjectFields = Omit<Fields, "name" | "description" | "descriptionFormat" | "status" | "sourceLocale">;

/** posts 側の変更。送られてこなかった項目は含めず、既存値を保つ */
function buildPostChanges(project: Project, fields: PostFields, previousSlug: string | undefined) {
  const { name, description, descriptionFormat, status, sourceLocale } = fields;

  let resolvedSourceLocale = sourceLocale;
  if (sourceLocale === "auto") {
    const bodyText = description !== undefined ? description : project.body;
    resolvedSourceLocale = detectSourceLocale(`${name ?? project.title}\n${bodyText}`);
  }

  // 下書きの間は「作成しただけ」の状態なので、他のステータスへ移した時点を作成日時とみなす
  const isLeavingDraft = project.visibility === "draft" && status !== undefined && status !== "draft";

  return {
    ...(name !== undefined ? { title: name } : {}),
    ...(description !== undefined ? { body: description } : {}),
    ...(descriptionFormat !== undefined ? { bodyFormat: descriptionFormat } : {}),
    ...(resolvedSourceLocale !== undefined ? { sourceLocale: resolvedSourceLocale } : {}),
    ...(status !== undefined ? { visibility: status } : {}),
    ...(fields.slug !== undefined ? { slug: fields.slug } : {}),
    ...(previousSlug !== undefined ? { previousSlug } : {}),
    ...(isLeavingDraft ? { createdAt: new Date() } : {}),
  };
}

/** projects 側の変更 */
function buildProjectChanges(fields: ProjectFields, links: Links, form: FormReader) {
  return {
    ...fields,
    // 送られてこなかった項目は undefined のままにして、既存値を保つ
    issueTrackerUrl: fields.issueTrackerUrl,
    sourceUrl: fields.sourceUrl === undefined ? undefined : fields.sourceUrl || null,
    links: fields.links === undefined ? undefined : fields.links || null,
    githubRepo: links.githubRepo,
    discordWebhookUrl: links.discordWebhookUrl,
    commentsEnabled: form.checkbox("commentsEnabled"),
    recipesEnabled: form.checkbox("recipesEnabled"),
    iconUrl: form.text("iconUrl") || undefined,
    aiGenerated: fields.aiGenerated,
  };
}
