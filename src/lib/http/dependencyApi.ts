import type { ActionResult } from "@modparks/core/actionResult";
import type { DependencyType } from "@modparks/core/dependencies/types";
import type { DependencyScope } from "@modparks/core/dependencies/entryTypes";
import { sendAppAction } from "@/lib/http/appApi";

/**
 * 依存関係の追加・削除（ブラウザ側）。modparks-api を呼ぶ。
 * 以前の Server Action（lib/actions/dependency.ts）と同じ名前・引数・戻り値にしてある。
 */
const projectPath = (projectId: string) => `/api/app/projects/${encodeURIComponent(projectId)}/dependencies`;

export const addProjectDependencyBySlug = (
  projectId: string,
  targetSlug: string,
  dependencyType: DependencyType,
  scope: DependencyScope = {},
) => sendAppAction<ActionResult>(projectPath(projectId), "POST", { targetSlug, dependencyType, scope });

export const addExternalProjectDependency = (
  projectId: string,
  externalName: string,
  externalUrl: string,
  dependencyType: DependencyType,
  scope: DependencyScope = {},
) => sendAppAction<ActionResult>(projectPath(projectId), "POST", { externalName, externalUrl, dependencyType, scope });

export const removeProjectDependency = (dependencyId: string) =>
  sendAppAction<ActionResult>(`/api/app/dependencies/${encodeURIComponent(dependencyId)}`, "DELETE");
