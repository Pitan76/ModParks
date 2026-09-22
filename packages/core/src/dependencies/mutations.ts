import { eq, and, isNull } from "drizzle-orm";
import type { Database } from "@modparks/core/db/client";
import { projectDependencies, versions } from "@modparks/core/db/schema";
import { findProjectPostById, findProjectPostBySlug } from "@modparks/core/queries/post";
import { canEditProject } from "@modparks/core/projects/access";
import { recordDeletion } from "@modparks/core/backup/tombstone";
import type { ServerErrorTranslator } from "@modparks/core/i18n/serverErrors";
import type { DependencyType } from "@modparks/core/dependencies/types";
import type { DependencyScope } from "@modparks/core/dependencies/entryTypes";

/**
 * 依存関係の追加・削除の本体。Next の Server Action と modparks-api の両方から呼ぶ。
 * 戻り値の slug はキャッシュを無効化する呼び出し側のためのもの。
 */
export type DependencyDeps = { db: Database; t: ServerErrorTranslator };

type DependencyResult = { success: true; slug: string } | { error: string };

/**
 * 想定内の拒否（入力ミス・重複・権限）に使う内部例外。
 *
 * 素の Error で投げると 500 として扱われ、本番では理由がクライアントへ渡らない。
 * ここで区別して、翻訳済みの理由を戻り値で返す。
 */
class DependencyRejection extends Error {
  constructor(readonly messageKey: DependencyErrorKey) {
    super(messageKey);
    this.name = "DependencyRejection";
  }
}

type DependencyErrorKey =
  | "common.notFound"
  | "common.forbidden"
  | "dependency.targetNotFound"
  | "dependency.selfDependency"
  | "dependency.alreadyExists"
  | "dependency.notFound"
  | "dependency.versionNotInProject"
  | "dependency.invalidExternalUrl";

/**
 * 依存関係を変更する処理の共通の外枠。
 * 想定内の拒否は理由付きで、それ以外はログを残したうえで汎用メッセージで返す（回復処理）。
 */
async function runDependencyMutation(t: ServerErrorTranslator, mutate: () => Promise<string>): Promise<DependencyResult> {
  try {
    return { success: true, slug: await mutate() };
  } catch (err) {
    if (err instanceof DependencyRejection) return { error: t(err.messageKey) };
    console.error("[DEPENDENCY] Mutation failed:", err);
    return { error: t("common.serverError") };
  }
}

/** 依存関係を編集できるのは作者・メンバー・管理者だけ。追加系の入口で必ず通す */
async function assertDependencyEditable(db: Database, userId: string, projectId: string) {
  const project = await findProjectPostById(db, projectId);
  if (!project) throw new DependencyRejection("common.notFound");
  if (!(await canEditProject(db, project, userId))) throw new DependencyRejection("common.forbidden");

  return project;
}

/**
 * バージョン限定の依存で指定されたバージョンを検証する。
 * 他プロジェクトのバージョンIDを渡して依存を紛れ込ませられないよう、所属を必ず確認する。
 */
async function resolveDependencyVersionId(db: Database, projectId: string, versionId?: string | null): Promise<string | null> {
  if (!versionId) return null;

  const version = await db
    .select({ id: versions.id })
    .from(versions)
    .where(and(eq(versions.id, versionId), eq(versions.projectId, projectId)))
    .get();
  if (!version) throw new DependencyRejection("dependency.versionNotInProject");

  return version.id;
}

/**
 * プラットフォーム指定を DB へ入れる形に整える。
 * 空指定は「全プラットフォーム」を意味するので、空配列ではなく null で持つ。
 */
function normalizeScopeLoaders(loaders?: string[]): string | null {
  const cleaned = (loaders ?? []).map((l) => l.trim()).filter(Boolean);
  return cleaned.length > 0 ? JSON.stringify(cleaned) : null;
}

/** 外部の依存先はそのままリンクとして出すため、http(s) 以外（javascript: など）を入れさせない */
function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * 依存関係を追加する（相手はスラッグで指定）。
 * versionId を渡すとそのバージョン限定の依存になる。省略時はプロジェクト全体。
 */
export async function addProjectDependencyBySlug(
  { db, t }: DependencyDeps,
  userId: string,
  projectId: string,
  targetSlug: string,
  dependencyType: DependencyType,
  scope: DependencyScope = {},
): Promise<DependencyResult> {
  return runDependencyMutation(t, async () => {
    const project = await assertDependencyEditable(db, userId, projectId);

    const targetProject = await findProjectPostBySlug(db, targetSlug);
    if (!targetProject) throw new DependencyRejection("dependency.targetNotFound");
    if (projectId === targetProject.id) throw new DependencyRejection("dependency.selfDependency");

    const scopedVersionId = await resolveDependencyVersionId(db, projectId, scope.versionId);
    const loaders = normalizeScopeLoaders(scope.loaders);

    // 同じ相手でも、プロジェクト全体とバージョン限定は別物として持てる。
    // プラットフォームが違えば別の依存（Fabric用とForge用）なので重複としない。
    const existing = await db
      .select({ id: projectDependencies.id })
      .from(projectDependencies)
      .where(and(
        eq(projectDependencies.projectId, projectId),
        eq(projectDependencies.targetProjectId, targetProject.id),
        scopedVersionId ? eq(projectDependencies.versionId, scopedVersionId) : isNull(projectDependencies.versionId),
        loaders ? eq(projectDependencies.loaders, loaders) : isNull(projectDependencies.loaders),
      ))
      .get();
    if (existing) throw new DependencyRejection("dependency.alreadyExists");

    await db.insert(projectDependencies).values({
      projectId,
      targetProjectId: targetProject.id,
      dependencyType,
      versionId: scopedVersionId,
      loaders,
    }).run();

    return project.slug;
  });
}

/** ModParks に無い依存先を、名前と URL で追加する */
export async function addExternalProjectDependency(
  { db, t }: DependencyDeps,
  userId: string,
  projectId: string,
  externalName: string,
  externalUrl: string,
  dependencyType: DependencyType,
  scope: DependencyScope = {},
): Promise<DependencyResult> {
  return runDependencyMutation(t, async () => {
    const project = await assertDependencyEditable(db, userId, projectId);
    if (!isHttpUrl(externalUrl)) throw new DependencyRejection("dependency.invalidExternalUrl");

    const scopedVersionId = await resolveDependencyVersionId(db, projectId, scope.versionId);
    await db.insert(projectDependencies).values({
      projectId,
      externalName,
      externalUrl,
      dependencyType,
      versionId: scopedVersionId,
      loaders: normalizeScopeLoaders(scope.loaders),
    }).run();

    return project.slug;
  });
}

/** 依存関係を削除する */
export async function removeProjectDependency({ db, t }: DependencyDeps, userId: string, dependencyId: string): Promise<DependencyResult> {
  return runDependencyMutation(t, async () => {
    const dep = await db.select().from(projectDependencies).where(eq(projectDependencies.id, dependencyId)).get();
    if (!dep) throw new DependencyRejection("dependency.notFound");

    const project = await assertDependencyEditable(db, userId, dep.projectId);
    await db.delete(projectDependencies).where(eq(projectDependencies.id, dependencyId)).run();
    await recordDeletion(db, "project_dependencies", dependencyId);

    return project.slug;
  });
}
