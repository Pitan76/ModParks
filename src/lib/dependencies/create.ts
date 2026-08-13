/**
 * 下書きの依存関係を保存できる形に解決する。
 *
 * バージョンのアップロードでは、バージョンが出来る前に依存が決まっている。
 * 先にここで解決しておくことで、「バージョンだけ出来て依存が入らない」中途半端な
 * 状態を作らずに済む（スラッグの打ち間違いはバージョン作成前に弾ける）。
 */
import { eq, and, inArray } from "drizzle-orm";
import { posts, projectDependencies } from "@/db/schema";
import { isAllowedExternalUrl } from "@/lib/validations";
import type { Database } from "@/lib/db";
import { MAX_DEPENDENCY_DRAFTS, type DependencyDraft } from "./types";

type ResolvedDependency = typeof projectDependencies.$inferInsert;

export type ResolveResult =
  | { ok: true; rows: ResolvedDependency[] }
  | { ok: false; error: string };

/**
 * 下書きを INSERT 可能な行へ解決する。
 *
 * @param projectId 依存を持つ側のプロジェクト
 * @param versionId 紐づけるバージョン。null ならプロジェクト全体の依存
 */
export async function resolveDependencyDrafts(
  db: Database,
  projectId: string,
  versionId: string | null,
  drafts: DependencyDraft[],
): Promise<ResolveResult> {
  if (drafts.length === 0) return { ok: true, rows: [] };
  if (drafts.length > MAX_DEPENDENCY_DRAFTS) {
    return { ok: false, error: `Too many dependencies (max ${MAX_DEPENDENCY_DRAFTS})` };
  }

  const slugs = [...new Set(drafts.map((d) => d.targetSlug?.trim()).filter((s): s is string => !!s))];

  const targets = slugs.length > 0
    ? await db
        .select({ id: posts.id, slug: posts.slug })
        .from(posts)
        .where(and(eq(posts.kind, "project"), inArray(posts.slug, slugs)))
        .all()
    : [];

  const idBySlug = new Map(targets.map((t: { id: string; slug: string }) => [t.slug, t.id]));

  const rows: ResolvedDependency[] = [];

  for (const draft of drafts) {
    const targetSlug = draft.targetSlug?.trim();
    const loaders = draft.loaders?.filter(Boolean) ?? [];
    const scope = {
      projectId,
      versionId,
      dependencyType: draft.dependencyType,
      loaders: loaders.length > 0 ? JSON.stringify(loaders) : null,
    };

    if (targetSlug) {
      const targetId = idBySlug.get(targetSlug);
      if (!targetId) return { ok: false, error: `Target project not found: ${targetSlug}` };
      if (targetId === projectId) return { ok: false, error: "Cannot depend on itself" };
      rows.push({ ...scope, targetProjectId: targetId });
      continue;
    }

    const externalName = draft.externalName?.trim();
    const externalUrl = draft.externalUrl?.trim();
    if (!externalName || !externalUrl) {
      return { ok: false, error: "Dependency needs a project slug or an external name and URL" };
    }
    if (!isAllowedExternalUrl(externalUrl)) {
      return { ok: false, error: `Disallowed dependency URL: ${externalUrl}` };
    }

    rows.push({ ...scope, externalName, externalUrl });
  }

  return { ok: true, rows };
}
