"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { getDatabase } from "@/lib/db";
import { revalidatePath } from "next/cache";
import * as mutations from "@modparks/core/dependencies/mutations";
import { getServerErrors } from "@/lib/i18n/serverErrors";
import type { ActionResult } from "@modparks/core/actionResult";
import type { DependencyType } from "@modparks/core/dependencies/types";
import type { DependencyScope, DependencyEntry } from "@modparks/core/dependencies/entryTypes";
import {
  getProjectDependencies as queryProjectDependencies,
  getVersionDependencies as queryVersionDependencies,
  getProjectDependents as queryProjectDependents,
} from "@modparks/core/queries/dependency";

export type { DependencyType } from "@modparks/core/dependencies/types";
export type { DependencyScope, DependencyProjectSummary, DependencyEntry } from "@modparks/core/dependencies/entryTypes";

/**
 * 取得系はクエリ本体（@modparks/core/queries/dependency）へ委譲する薄いラッパ。
 *
 * クライアントコンポーネントから直接クエリを import すると、`@/lib/db` 以下の
 * サーバー専用モジュール（node:dns 等）がクライアントバンドルに引き込まれて
 * ビルドが壊れる。ここを通せば Server Action として RPC 化される。
 * "use server" ファイルは再エクスポートを許さないため、関数として書き下している。
 *
 * サーバーコンポーネントやルートハンドラからは、RPC を経由せずクエリ本体を直接使う。
 */
export async function getProjectDependencies(projectId: string, includeVersionScoped = false): Promise<DependencyEntry[]> {
  const db = await getDatabase();
  return queryProjectDependencies(db, projectId, includeVersionScoped);
}

export async function getVersionDependencies(projectId: string, versionId: string): Promise<DependencyEntry[]> {
  const db = await getDatabase();
  return queryVersionDependencies(db, projectId, versionId);
}

export async function getProjectDependents(projectId: string) {
  const db = await getDatabase();
  return queryProjectDependents(db, projectId);
}

// ---- 変更系（本体は core/dependencies/mutations.ts） ----

async function dependencyDeps() {
  const { db, session } = await getAuthenticatedDb();
  return { deps: { db, t: await getServerErrors() }, userId: session.user.id };
}

/** 成功したら、依存関係を表示するページを無効化し、Server Action の戻り値の形に戻す */
function finish(result: { success: true; slug: string } | { error: string }): ActionResult {
  if ("error" in result) return result;

  revalidatePath(`/projects/${result.slug}`);
  revalidatePath(`/projects/${result.slug}/dependencies`);
  revalidatePath(`/projects/${result.slug}/edit`);
  return { success: true };
}

/**
 * プロジェクトに依存関係を追加する（Slugで指定）。
 * versionId を渡すとそのバージョン限定の依存になる。省略時はプロジェクト全体。
 */
export async function addProjectDependencyBySlug(
  projectId: string,
  targetSlug: string,
  dependencyType: DependencyType,
  scope: DependencyScope = {},
): Promise<ActionResult> {
  const { deps, userId } = await dependencyDeps();
  return finish(await mutations.addProjectDependencyBySlug(deps, userId, projectId, targetSlug, dependencyType, scope));
}

export async function addExternalProjectDependency(
  projectId: string,
  externalName: string,
  externalUrl: string,
  dependencyType: DependencyType,
  scope: DependencyScope = {},
): Promise<ActionResult> {
  const { deps, userId } = await dependencyDeps();
  return finish(await mutations.addExternalProjectDependency(deps, userId, projectId, externalName, externalUrl, dependencyType, scope));
}

/** プロジェクトの依存関係を削除する */
export async function removeProjectDependency(dependencyId: string): Promise<ActionResult> {
  const { deps, userId } = await dependencyDeps();
  return finish(await mutations.removeProjectDependency(deps, userId, dependencyId));
}
