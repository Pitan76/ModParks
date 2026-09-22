import { eq, and } from "drizzle-orm";
import type { Database } from "@modparks/core/db/client";
import { versions, projects } from "@modparks/core/db/schema";
import { r2KeyFromUrl } from "@modparks/core/r2";
import { isAllowedExternalUrl } from "@modparks/core/validations";
import type { JarClient } from "@modparks/core/jar/client";
import type { JarSource } from "@modparks/core/jar/types";
import { findProjectPostBySlug } from "@modparks/core/queries/post";
import { canEditProject } from "@modparks/core/projects/access";
import { isSharedNamespace } from "@modparks/core/data/sharedNamespaces";
import type { ServerErrorTranslator } from "@modparks/core/i18n/serverErrors";

/**
 * バージョンの JAR からのレシピ抽出と、ブラウザで抽出したレシピの中継アップロードの本体。
 * Next の Server Action と modparks-api の両方から呼ぶ。
 */

/** レシピ CDN の接続先。秘密値を含むので呼び出し側が環境から取って渡す */
export type RecipeCdnConfig = {
  url: string;
  /** jar Worker から CDN の API へ直接上げるか（USE_RECIPE_CDN_API） */
  useApi: boolean;
  /** 中継アップロードの認証（RECIPE_CDN_SECRET） */
  secret: string | undefined;
};

export type RecipeDeps = {
  db: Database;
  t: ServerErrorTranslator;
  jar: JarClient;
  r2PublicUrl: string | undefined;
  cdn: RecipeCdnConfig;
};

type RecipeResult = { success: true; count: number; slug: string } | { error: string };

type RecipeBucket = {
  recipes?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  textures?: Record<string, unknown>;
  models?: Record<string, unknown>;
  langs?: Record<string, unknown>;
};

/** 種別が揃った空のバケット。共有ネームスペースをタグだけに削るときの土台。 */
const emptyBucket = (): RecipeBucket => ({ recipes: {}, tags: {}, textures: {}, models: {}, langs: {} });

const sizeOf = (record: Record<string, unknown> | undefined) => Object.keys(record || {}).length;

/**
 * JSON文字列で保持している配列カラムを読み出す。
 * @returns 文字列の配列。壊れていれば空配列
 */
function parseJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/** 編集可能なプロジェクトと、そこに属するバージョンを取る。権限なしは移設前と同じく例外 */
async function loadVersion({ db, t }: RecipeDeps, userId: string, versionId: string, projectSlug: string) {
  const project = await findProjectPostBySlug(db, projectSlug);
  if (!project) return { error: t("project.notFound") };
  if (!(await canEditProject(db, project, userId))) throw new Error("Forbidden");

  const version = await db
    .select()
    .from(versions)
    .where(and(eq(versions.id, versionId), eq(versions.projectId, project.id)))
    .get();
  if (!version) return { error: t("version.notFound") };

  return { project, version };
}

/** レシピを持つネームスペースを、プロジェクトの一覧に足す */
async function mergeNamespaces(db: Database, project: { id: string; recipeNamespaces?: unknown }, namespaces: string[]) {
  if (namespaces.length === 0) return;

  const existing = Array.isArray(project.recipeNamespaces) ? (project.recipeNamespaces as string[]) : [];
  const merged = Array.from(new Set([...existing, ...namespaces])).sort();
  if (merged.length === existing.length) return;

  await db.update(projects).set({ recipeNamespaces: merged }).where(eq(projects.id, project.id)).run();
}

/** JARファイル内のレシピを jar Worker で抽出し、CDN/R2 に上げてプロジェクトに関連付ける */
export async function extractRecipesFromVersion(deps: RecipeDeps, userId: string, versionId: string, projectSlug: string): Promise<RecipeResult> {
  const loaded = await loadVersion(deps, userId, versionId, projectSlug);
  if ("error" in loaded) return { error: loaded.error ?? "" };
  const { project, version } = loaded;
  if (!version.fileUrl) return { error: deps.t("version.noFileUrl") };

  const r2Key = r2KeyFromUrl(deps.r2PublicUrl, version.fileUrl);
  if (!r2Key && !isAllowedExternalUrl(version.fileUrl)) return { error: deps.t("version.recipeDomainNotAllowed") };

  // ファイルの取得も解析も modparks-jar Worker 側で行う（jszip を本体に載せないため）
  const source: JarSource = r2Key ? { kind: "r2", key: r2Key } : { kind: "url", url: version.fileUrl };

  // jar Worker と CDN は外部I/O境界。失敗は画面に出す文言として返す
  try {
    // 対象 MC バージョンは version レコードが正。JAR の依存宣言より、公開者の申告を優先する。
    const { count, namespaces } = await deps.jar.extractRecipes(source, deps.cdn.url, deps.cdn.useApi, {
      mcVersions: parseJsonArray(version.mcVersions),
      modVersion: version.versionNumber,
      loader: parseJsonArray(version.loaders)[0] ?? null,
    });
    await mergeNamespaces(deps.db, project, namespaces);

    return { success: true, count, slug: project.slug };
  } catch (err: unknown) {
    console.error("Failed to extract recipes:", err);
    return { error: err instanceof Error ? err.message : "Failed to extract recipes" };
  }
}

/**
 * ブラウザから届いた中身をそのまま流さない。この経路は共有シークレットを持つため
 * CDN 側の「共有NSはタグのみ」判定を素通りする。実際、これで共有 minecraft NS に
 * バニラのレシピ 1056 件が流れ込んだ。
 */
const sanitizeBucket = (ns: string, raw: RecipeBucket): RecipeBucket =>
  isSharedNamespace(ns) ? { ...emptyBucket(), tags: raw.tags ?? {} } : raw;

/** 1 つのネームスペースを CDN へ上げる。@returns CDN が受け付けた件数 */
async function uploadBucket(cdn: RecipeCdnConfig, ns: string, bucket: RecipeBucket): Promise<number> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cdn.secret) headers["Authorization"] = `Bearer ${cdn.secret}`;

  const res = await fetch(`${cdn.url}/api/${ns}/bulk`, { method: "POST", headers, body: JSON.stringify(bucket) });
  if (!res.ok) throw new Error(`CDN bulk upload failed for ${ns}: ${res.status} ${res.statusText}`);

  const body = (await res.json()) as Record<string, number | undefined>;
  return (body.recipes || 0) + (body.textures || 0) + (body.models || 0) + (body.tags || 0) + (body.langs || 0);
}

/** ブラウザで抽出されたレシピ・テクスチャを、サーバーから CDN に中継アップロードしてプロジェクトに関連付ける */
export async function uploadClientExtractedRecipes(
  deps: RecipeDeps,
  userId: string,
  versionId: string,
  projectSlug: string,
  byNs: Record<string, RecipeBucket>,
): Promise<RecipeResult> {
  const loaded = await loadVersion(deps, userId, versionId, projectSlug);
  if ("error" in loaded) return { error: loaded.error ?? "" };

  let totalCount = 0;
  const namespaces: string[] = [];
  // CDN は外部I/O境界。失敗は画面に出す文言として返す
  try {
    for (const [ns, rawBucket] of Object.entries(byNs)) {
      const bucket = sanitizeBucket(ns, rawBucket);
      const count = sizeOf(bucket.recipes) + sizeOf(bucket.tags) + sizeOf(bucket.textures) + sizeOf(bucket.models) + sizeOf(bucket.langs);
      if (count === 0) continue;

      // レシピを持たない ns（data/minecraft/tags だけ同梱など）を混ぜると、CDN の共有
      // minecraft 名前空間を丸ごと引いてバニラレシピが一覧に並んでしまう。
      // アップロードはタグやテクスチャの描画に要るので全 ns 行う。
      if (sizeOf(bucket.recipes) > 0) namespaces.push(ns);
      totalCount += await uploadBucket(deps.cdn, ns, bucket);
    }
    await mergeNamespaces(deps.db, loaded.project, namespaces);

    return { success: true, count: totalCount, slug: loaded.project.slug };
  } catch (err: unknown) {
    console.error("Failed to upload extracted recipes:", err);
    return { error: err instanceof Error ? err.message : "Failed to upload extracted recipes" };
  }
}
