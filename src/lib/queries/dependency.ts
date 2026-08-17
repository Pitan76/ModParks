import { getDatabase } from "@/lib/db";
import { projectDependencies, posts, projects, versions } from "@/db/schema";
import { eq, and, isNull, or } from "drizzle-orm";
import { dependencyAppliesToLoaders, parseDependencyLoaders } from "@/lib/dependencies/scope";
import { toStringArray } from "@/lib/utils/format";
import type { DependencyType } from "@/lib/dependencies/types";
import type { DependencyEntry, DependencyProjectSummary } from "@/lib/dependencies/entryTypes";

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
