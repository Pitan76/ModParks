import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { Database } from "@modparks/core/db/client";
import { ideas, ideaTags, posts, userSettings } from "@modparks/core/db/schema";
import { createIdeaSchema } from "@modparks/core/validations";
import { recordDeletion } from "@modparks/core/backup/tombstone";
import type { ServerErrorTranslator } from "@modparks/core/i18n/serverErrors";
import { formList, loadManageableIdea } from "@modparks/core/ideas/shared";

/**
 * idea の作成・編集・状態変更・削除の本体。
 *
 * Next の Server Action と modparks-api の両方から呼ぶ。戻り値は移設前の
 * Server Action と同じ形にしてあり、画面側は呼び方だけを変えれば済む。
 * キャッシュの無効化は呼び出し側で行う（Next は revalidatePath、modparks-api は不要）。
 */
export type IdeaDeps = { db: Database; t: ServerErrorTranslator };

function readIdeaFields(formData: FormData) {
  return createIdeaSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
    contentFormat: formData.get("contentFormat"),
    visibility: formData.get("visibility"),
  });
}

/** 作成 */
export async function createIdea({ db, t }: IdeaDeps, userId: string, formData: FormData) {
  const parsed = readIdeaFields(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const id = createId();
  const { title, content, contentFormat, visibility } = parsed.data;
  const tags = formList(formData, "tags");
  const loaders = formList(formData, "loaders");
  const mcVersions = formList(formData, "mcVersions");

  // DB は外部I/O境界。失敗は表示用の文言にして返す（移設前と同じ）
  try {
    const settings = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).get();

    // タグは任意なので、あるときだけ文を足す。
    // batch の第1要素が必ず埋まる形にして、タプル型のまま渡せるようにする
    const tagInserts = tags.length > 0 ? [db.insert(ideaTags).values(tags.map((tag) => ({ ideaId: id, tag })))] : [];

    // Idea の slug は作成時点では id と同じランダム値。作者が後から変更できる。
    await db.batch([
      db.insert(posts).values({
        id,
        authorId: userId,
        kind: "idea",
        slug: id,
        title,
        body: content,
        bodyFormat: contentFormat || settings?.defaultIdeaBodyFormat || "markdown",
        visibility: visibility || settings?.defaultIdeaStatus || "public",
      }),
      db.insert(ideas).values({
        id,
        status: "open",
        loaders: loaders.length > 0 ? JSON.stringify(loaders) : null,
        mcVersions: mcVersions.length > 0 ? JSON.stringify(mcVersions) : null,
      }),
      ...tagInserts,
    ]);

    return { success: true as const, id };
  } catch (error) {
    console.error("Failed to create idea:", error);
    return { error: { server: [t("idea.createFailed")] } };
  }
}

/** 編集。投稿者本人または管理者のみ許可 */
export async function updateIdea({ db, t }: IdeaDeps, userId: string, ideaId: string, formData: FormData) {
  const loaded = await loadManageableIdea(db, t, ideaId, userId, "idea.noEditPermission");
  if (loaded.error) return { error: { server: [loaded.error] } };

  const parsed = readIdeaFields(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { title, content, contentFormat, visibility } = parsed.data;
  const tags = formList(formData, "tags");
  const loaders = formList(formData, "loaders");
  const mcVersions = formList(formData, "mcVersions");

  // タイトル・本文・公開範囲はすべて posts 側にある
  await db.update(posts)
    .set({ title, body: content, bodyFormat: contentFormat, visibility: visibility || "public", updatedAt: new Date() })
    .where(eq(posts.id, ideaId))
    .run();

  await db.update(ideas)
    .set({
      loaders: loaders.length > 0 ? JSON.stringify(loaders) : null,
      mcVersions: mcVersions.length > 0 ? JSON.stringify(mcVersions) : null,
    })
    .where(eq(ideas.id, ideaId))
    .run();

  await db.delete(ideaTags).where(eq(ideaTags.ideaId, ideaId)).run();
  if (tags.length > 0) await db.insert(ideaTags).values(tags.map((tag) => ({ ideaId, tag }))).run();

  return { success: true as const };
}

const IDEA_STATUSES = ["open", "in_progress", "fulfilled"] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

/** 状態の変更。投稿者本人または管理者のみ許可 */
export async function updateIdeaStatus({ db, t }: IdeaDeps, userId: string, ideaId: string, status: string) {
  const loaded = await loadManageableIdea(db, t, ideaId, userId, "idea.noStatusPermission");
  if (loaded.error) return { error: { server: [loaded.error] } };
  if (!(IDEA_STATUSES as readonly string[]).includes(status)) return { error: { server: [t("idea.invalidStatus")] } };

  await db.batch([
    db.update(ideas).set({ status: status as IdeaStatus }).where(eq(ideas.id, ideaId)),
    db.update(posts).set({ updatedAt: new Date() }).where(eq(posts.id, ideaId)),
  ]);

  return { success: true as const };
}

/** 削除。投稿者本人または管理者のみ許可。失敗時の error は文字列（移設前の形） */
export async function deleteIdea({ db, t }: IdeaDeps, userId: string, ideaId: string) {
  const loaded = await loadManageableIdea(db, t, ideaId, userId, "idea.noDeletePermission");
  if (loaded.error) return { error: loaded.error };

  // posts を削除すると ideas / comments / favorites は cascade で消える
  await db.delete(posts).where(eq(posts.id, ideaId)).run();
  await recordDeletion(db, "posts", ideaId);

  return { success: true as const };
}
