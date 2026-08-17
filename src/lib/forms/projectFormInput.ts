import { FormReader } from "@/lib/forms/formReader";

/**
 * プロジェクトのフォーム入力を、検証スキーマに渡せる形へ組み立てる。
 *
 * Server Action から切り離してあるのは、I/O を挟まずに
 * 「どの画面から送っても意図した項目だけが更新対象になるか」を試験するため。
 */

/** 新規作成フォームの入力 */
export function buildProjectCreateInput(formData: FormData) {
  const form = new FormReader(formData);

  return {
    name:        form.text("name"),
    slug:        form.text("slug"),
    description: form.text("description"),
    descriptionFormat: form.text("descriptionFormat"),
    type:        form.text("type"),
    license:     form.text("license"),
    sourceUrl:   form.text("sourceUrl"),
    links:       form.text("links"),
    tags:        form.list("tags") ?? [],
    githubReleaseImportMode: form.text("githubReleaseImportMode"),
    aiGenerated: form.checkbox("aiGenerated") ?? false,
  };
}

/**
 * 編集フォームの入力。
 *
 * 画面ごとに送る項目が違う（基本情報タブは説明を持たない等）ので、
 * 未送信の項目は必ず undefined になり、更新対象から外れる。
 */
export function buildProjectUpdateInput(formData: FormData) {
  const form = new FormReader(formData);

  return {
    name:        form.text("name"),
    slug:        form.text("slug"),
    description: form.text("description"),
    descriptionFormat: form.text("descriptionFormat"),
    type:        form.text("type"),
    license:     form.text("license"),
    sourceUrl:   form.text("sourceUrl"),
    links:       form.text("links"),
    status:      form.text("status"),
    modrinthId:  form.nullableText("modrinthId"),
    curseforgeId: form.nullableText("curseforgeId"),
    githubRepo:  form.nullableText("githubRepo"),
    discordWebhookUrl: form.nullableText("discordWebhookUrl"),
    issueTrackerUrl: form.nullableText("issueTrackerUrl"),
    githubReleaseImportMode: form.text("githubReleaseImportMode"),
    tags:        form.list("tags"),
    aiGenerated: form.checkbox("aiGenerated"),
  };
}
