import type { Context } from "hono";
import * as mutations from "@modparks/core/dependencies/mutations";
import { DEPENDENCY_TYPES, type DependencyType } from "@modparks/core/dependencies/types";
import type { DependencyScope } from "@modparks/core/dependencies/entryTypes";
import type { ApiWorkerEnv } from "../env";
import { requireSession } from "../requireSession";
import { serverErrorsFor } from "../serverErrors";
import { respond } from "../appContext";

type Ctx = Context<{ Bindings: ApiWorkerEnv }>;

/**
 * 依存関係の追加・削除（/api/app/projects/:id/dependencies, /api/app/dependencies/:id）。
 * 以前は Server Action だった。本体は core/dependencies/mutations.ts。
 */

type AddBody = {
  targetSlug: unknown;
  externalName: unknown;
  externalUrl: unknown;
  dependencyType: unknown;
  scope: { versionId?: unknown; loaders?: unknown };
};

const isDependencyType = (value: unknown): value is DependencyType =>
  typeof value === "string" && (DEPENDENCY_TYPES as readonly string[]).includes(value);

function readScope(raw: AddBody["scope"] | undefined): DependencyScope {
  const loaders = Array.isArray(raw?.loaders) ? raw.loaders.filter((l): l is string => typeof l === "string") : undefined;
  return { versionId: typeof raw?.versionId === "string" ? raw.versionId : null, loaders };
}

/**
 * POST /api/app/projects/:id/dependencies
 * 本文は { dependencyType, scope?, targetSlug } か { dependencyType, scope?, externalName, externalUrl }
 */
export async function postDependency(c: Ctx) {
  const auth = await requireSession(c);
  if (auth instanceof Response) return auth;

  const body = await c.req.json<Partial<AddBody>>().catch(() => ({} as Partial<AddBody>));
  if (!isDependencyType(body.dependencyType)) return c.json({ error: "invalid_request" }, 400);

  const deps = { db: auth.db, t: serverErrorsFor(c.req.raw) };
  const projectId = c.req.param("id")!;
  const scope = readScope(body.scope);
  if (typeof body.targetSlug === "string") {
    return respond(c, await mutations.addProjectDependencyBySlug(deps, auth.userId, projectId, body.targetSlug, body.dependencyType, scope));
  }
  if (typeof body.externalName !== "string" || typeof body.externalUrl !== "string") return c.json({ error: "invalid_request" }, 400);

  return respond(c, await mutations.addExternalProjectDependency(
    deps, auth.userId, projectId, body.externalName, body.externalUrl, body.dependencyType, scope,
  ));
}

/** DELETE /api/app/dependencies/:id */
export async function deleteDependency(c: Ctx) {
  const auth = await requireSession(c);
  if (auth instanceof Response) return auth;

  const deps = { db: auth.db, t: serverErrorsFor(c.req.raw) };

  return respond(c, await mutations.removeProjectDependency(deps, auth.userId, c.req.param("id")!));
}
