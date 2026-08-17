"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { projectDependencies, projectMembers, versions } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recordDeletion } from "@/lib/backup/tombstone";
import { findProjectPostById, findProjectPostBySlug } from "@/lib/queries/post";
import { isAdminSession } from "@/lib/auth/roles";
import { getServerErrors } from "@/lib/i18n/serverErrors";
import type { ActionResult } from "@/lib/actions/actionResult";
import type { DependencyType } from "@/lib/dependencies/types";
import type { DependencyScope } from "@/lib/dependencies/entryTypes";

// 型は "use server" ファイルからも再公開できる（値の再エクスポートは不可）ため、
// 既存の import パスを壊さないようここに残す。
// 取得系（getProjectDependencies など）は @/lib/queries/dependency から直接 import する。
export type { DependencyType } from "@/lib/dependencies/types";
export type { DependencyScope, DependencyProjectSummary, DependencyEntry } from "@/lib/dependencies/entryTypes";

/**
 * 想定内の拒否（入力ミス・重複・権限）に使う内部例外。
 *
 * これらを素の Error で投げると Next.js が 500 として扱い、ログにはサーバー障害として
 * 積まれる一方、本番では理由がクライアントへ渡らない（メッセージが伏せられる）。
 * つまり利用者にも運営者にも「何が起きたか」が残らない。
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
  | "dependency.versionNotInProject";

/**
 * 依存関係を変更する Server Action の共通の外枠。
 *
 * 想定内の拒否は理由付きで、それ以外はサーバー側にログを残したうえで
 * 汎用メッセージで返す。どちらの場合も 500 にはしない。
 */
async function runDependencyMutation(mutate: () => Promise<void>): Promise<ActionResult> {
  const t = await getServerErrors();
  try {
    await mutate();
    return { success: true };
  } catch (err) {
    if (err instanceof DependencyRejection) {
      return { error: t(err.messageKey) };
    }
    console.error("[DEPENDENCY] Mutation failed:", err);
    return { error: t("common.serverError") };
  }
}

/**
 * 依存関係を編集できるのは作者・メンバー・管理者だけ。追加系の入口で必ず通す。
 *
 * @returns 対象プロジェクト（revalidate 用に slug が要る）
 */
async function assertDependencyEditable(
  db: Awaited<ReturnType<typeof getAuthenticatedDb>>["db"],
  session: Awaited<ReturnType<typeof getAuthenticatedDb>>["session"],
  projectId: string,
) {
  const project = await findProjectPostById(db, projectId);
  if (!project) throw new DependencyRejection("common.notFound");

  const member = await db.select().from(projectMembers).where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, session.user.id))).get();
  if (project.authorId !== session.user.id && !member && !isAdminSession(session)) {
    throw new DependencyRejection("common.forbidden");
  }

  return project;
}

/**
 * バージョン限定の依存で指定されたバージョンを検証する。
 *
 * 他プロジェクトのバージョンIDを渡して依存を紛れ込ませられないよう、所属を必ず確認する。
 */
async function resolveDependencyVersionId(
  db: Awaited<ReturnType<typeof getAuthenticatedDb>>["db"],
  projectId: string,
  versionId?: string | null,
): Promise<string | null> {
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

/** 依存関係の追加・削除後に貼り替えが要るページ */
function revalidateDependencyPaths(slug: string) {
  revalidatePath(`/projects/${slug}`);
  revalidatePath(`/projects/${slug}/dependencies`);
  revalidatePath(`/projects/${slug}/edit`);
}

/**
 * プロジェクトに依存関係を追加する（Slugで指定）。
 *
 * versionId を渡すとそのバージョン限定の依存になる。省略時はプロジェクト全体。
 */
export async function addProjectDependencyBySlug(
  projectId: string,
  targetSlug: string,
  dependencyType: DependencyType,
  scope: DependencyScope = {},
): Promise<ActionResult> {
  return runDependencyMutation(async () => {
    const { db, session } = await getAuthenticatedDb();

    const project = await assertDependencyEditable(db, session, projectId);

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

    revalidateDependencyPaths(project.slug);
  });
}

export async function addExternalProjectDependency(
  projectId: string,
  externalName: string,
  externalUrl: string,
  dependencyType: DependencyType,
  scope: DependencyScope = {},
): Promise<ActionResult> {
  return runDependencyMutation(async () => {
    const { db, session } = await getAuthenticatedDb();

    const project = await assertDependencyEditable(db, session, projectId);
    const scopedVersionId = await resolveDependencyVersionId(db, projectId, scope.versionId);

    await db.insert(projectDependencies).values({
      projectId,
      externalName,
      externalUrl,
      dependencyType,
      versionId: scopedVersionId,
      loaders: normalizeScopeLoaders(scope.loaders),
    }).run();

    revalidateDependencyPaths(project.slug);
  });
}

/**
 * プロジェクトの依存関係を削除する
 */
export async function removeProjectDependency(dependencyId: string): Promise<ActionResult> {
  return runDependencyMutation(async () => {
    const { db, session } = await getAuthenticatedDb();

    const dep = await db.select().from(projectDependencies).where(eq(projectDependencies.id, dependencyId)).get();
    if (!dep) throw new DependencyRejection("dependency.notFound");

    const project = await assertDependencyEditable(db, session, dep.projectId);

    await db.delete(projectDependencies).where(eq(projectDependencies.id, dependencyId)).run();
    await recordDeletion(db, "project_dependencies", dependencyId);

    revalidateDependencyPaths(project.slug);
  });
}
