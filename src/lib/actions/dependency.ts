"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { getDatabase } from "@/lib/db";
import { projectDependencies, posts, projects, projectMembers, versions } from "@/db/schema";
import { eq, and, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recordDeletion } from "@/lib/backup/tombstone";
import { findProjectPostById, findProjectPostBySlug } from "@/lib/queries/post";
import { isAdminSession } from "@/lib/auth/roles";
import { dependencyAppliesToLoaders, parseDependencyLoaders } from "@/lib/dependencies/scope";
import { toStringArray } from "@/lib/utils/format";
import type { DependencyType } from "@/lib/dependencies/types";

export type { DependencyType } from "@/lib/dependencies/types";

/** 依存の適用範囲。バージョン限定にするか、どのプラットフォームに要るか */
export type DependencyScope = {
  /** 指定するとそのバージョン限定の依存になる。省略時はプロジェクト全体 */
  versionId?: string | null;
  /** 依存が要るプラットフォーム。空なら全プラットフォーム */
  loaders?: string[];
};

/** 依存関係カードに出す最小限のプロジェクト情報。存在しない外部依存も同じ形で表す */
export interface DependencyProjectSummary {
  id: string;
  slug: string;
  title: string;
  iconUrl: string | null;
}

/** 依存関係 1 件の表示用の形。バージョン限定かどうかも持つ */
export type DependencyEntry = {
  id: string;
  dependencyType: DependencyType;
  project: DependencyProjectSummary;
  externalUrl: string | null;
  externalName: string | null;
  /** バージョン限定の依存なら対象バージョンID。null ならプロジェクト全体 */
  versionId: string | null;
  /** バージョン限定の依存の表示用バージョン番号 */
  versionNumber: string | null;
  /** 依存が要るプラットフォーム。空なら全プラットフォーム */
  loaders: string[];
};

const DEPENDENCY_COLUMNS = {
  id: projectDependencies.id,
  dependencyType: projectDependencies.dependencyType,
  targetPost: posts,
  targetProject: projects,
  externalUrl: projectDependencies.externalUrl,
  externalName: projectDependencies.externalName,
  versionId: projectDependencies.versionId,
  versionNumber: versions.versionNumber,
  loaders: projectDependencies.loaders,
};

type DependencyRow = {
  id: string;
  dependencyType: string;
  targetPost: typeof posts.$inferSelect | null;
  targetProject: typeof projects.$inferSelect | null;
  externalUrl: string | null;
  externalName: string | null;
  versionId: string | null;
  versionNumber: string | null;
  loaders: string | null;
};

const toDependencyEntry = (d: DependencyRow): DependencyEntry => ({
  id: d.id,
  dependencyType: d.dependencyType as DependencyType,
  project: (d.targetPost
    ? { id: d.targetPost.id, slug: d.targetPost.slug, title: d.targetPost.title, iconUrl: d.targetProject?.iconUrl ?? null }
    : { id: d.id, slug: d.id, title: d.externalName || "Unknown External", iconUrl: null }) satisfies DependencyProjectSummary,
  externalUrl: d.externalUrl,
  externalName: d.externalName,
  versionId: d.versionId,
  versionNumber: d.versionNumber,
  loaders: parseDependencyLoaders(d.loaders),
});

/**
 * プロジェクトの依存関係を取得する。
 *
 * 既定ではプロジェクト全体の依存（バージョン限定でないもの）だけを返す。
 * バージョン限定の依存はファイルごとに違うため、混ぜると「今どれが要るのか」が読めなくなる。
 */
export async function getProjectDependencies(projectId: string, includeVersionScoped = false): Promise<DependencyEntry[]> {
  const db = await getDatabase();

  const scope = includeVersionScoped
    ? eq(projectDependencies.projectId, projectId)
    : and(eq(projectDependencies.projectId, projectId), isNull(projectDependencies.versionId));

  const deps = await db
    .select(DEPENDENCY_COLUMNS)
    .from(projectDependencies)
    .leftJoin(projects, eq(projectDependencies.targetProjectId, projects.id))
    .leftJoin(posts, eq(posts.id, projects.id))
    .leftJoin(versions, eq(projectDependencies.versionId, versions.id))
    .where(scope)
    .all();

  return deps.map(toDependencyEntry);
}

/**
 * バージョンに適用される依存関係を取得する。
 *
 * そのバージョン限定のものと、プロジェクト全体のものを両方返す。
 * どちらなのかは versionId で見分けられる。
 *
 * プロジェクト全体の依存にプラットフォーム指定がある場合（Fabric なら Fabric API など）は、
 * そのバージョンのローダーに合うものだけを返す。合わないものを並べると、
 * 利用者には「要らないものを要求されている」ようにしか見えないため。
 */
export async function getVersionDependencies(projectId: string, versionId: string): Promise<DependencyEntry[]> {
  const db = await getDatabase();

  const [deps, version] = await Promise.all([
    db
      .select(DEPENDENCY_COLUMNS)
      .from(projectDependencies)
      .leftJoin(projects, eq(projectDependencies.targetProjectId, projects.id))
      .leftJoin(posts, eq(posts.id, projects.id))
      .leftJoin(versions, eq(projectDependencies.versionId, versions.id))
      .where(and(
        eq(projectDependencies.projectId, projectId),
        or(isNull(projectDependencies.versionId), eq(projectDependencies.versionId, versionId)),
      ))
      .all(),
    db
      .select({ loaders: versions.loaders })
      .from(versions)
      .where(eq(versions.id, versionId))
      .get(),
  ]);

  const versionLoaders = version ? toStringArray(version.loaders) : [];

  return deps
    .map(toDependencyEntry)
    .filter((dep) => dependencyAppliesToLoaders(dep.loaders, versionLoaders))
    // バージョン限定のものを先に出す。実際に効く条件から読ませたい
    .sort((a, b) => Number(!!b.versionId) - Number(!!a.versionId));
}

/**
 * このプロジェクトに依存しているプロジェクト（逆引き）を取得する
 */
export async function getProjectDependents(projectId: string) {
  const db = await getDatabase();

  const deps = await db
    .select({
      id: projectDependencies.id,
      dependencyType: projectDependencies.dependencyType,
      sourcePost: posts,
      sourceProject: projects,
    })
    .from(projectDependencies)
    .innerJoin(projects, eq(projectDependencies.projectId, projects.id))
    .innerJoin(posts, eq(posts.id, projects.id))
    .where(eq(projectDependencies.targetProjectId, projectId))
    .all();

  return deps.map((d) => ({
    id: d.id,
    dependencyType: d.dependencyType as DependencyType,
    project: {
      id: d.sourcePost.id,
      slug: d.sourcePost.slug,
      title: d.sourcePost.title,
      iconUrl: d.sourceProject.iconUrl,
    } satisfies DependencyProjectSummary,
  }));
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
  if (!project) throw new Error("Project not found");

  const member = await db.select().from(projectMembers).where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, session.user.id))).get();
  if (project.authorId !== session.user.id && !member && !isAdminSession(session)) {
    throw new Error("Forbidden");
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

  if (!version) throw new Error("Version not found in this project");
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
) {
  const { db, session } = await getAuthenticatedDb();

  const project = await assertDependencyEditable(db, session, projectId);

  const targetProject = await findProjectPostBySlug(db, targetSlug);
  if (!targetProject) throw new Error("Target project not found");

  if (projectId === targetProject.id) {
    throw new Error("Cannot depend on itself");
  }

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

  if (existing) {
    throw new Error("Dependency already exists");
  }

  await db.insert(projectDependencies).values({
    projectId,
    targetProjectId: targetProject.id,
    dependencyType,
    versionId: scopedVersionId,
    loaders,
  }).run();

  revalidateDependencyPaths(project.slug);
  return { success: true };
}

export async function addExternalProjectDependency(
  projectId: string,
  externalName: string,
  externalUrl: string,
  dependencyType: DependencyType,
  scope: DependencyScope = {},
) {
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
  return { success: true };
}



/**
 * プロジェクトの依存関係を削除する
 */
export async function removeProjectDependency(dependencyId: string) {
  const { db, session } = await getAuthenticatedDb();

  const dep = await db.select().from(projectDependencies).where(eq(projectDependencies.id, dependencyId)).get();
  if (!dep) throw new Error("Dependency not found");

  const project = await assertDependencyEditable(db, session, dep.projectId);

  await db.delete(projectDependencies).where(eq(projectDependencies.id, dependencyId)).run();
  await recordDeletion(db, "project_dependencies", dependencyId);

  revalidateDependencyPaths(project.slug);
  return { success: true };
}
