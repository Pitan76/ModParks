/**
 * アップロード先プロジェクトに対する書き込み権限の判定。
 *
 * presign（署名付きURL発行）と direct（Worker 経由 PUT）で同じ判定が必要になる。
 * 片方だけ条件が緩むとそちらが素通り口になるため、判定はこの 1 箇所に集約する。
 */

import { ADMIN_ROLE } from "@/lib/auth/roles";

/** 権限判定の結果。失敗時はそのまま HTTP 応答に使えるステータスと文言を持つ。 */
export type UploadAccess = { ok: true; projectType?: string } | { ok: false; status: number; error: string };

const DENIED: UploadAccess = {
  ok: false,
  status: 403,
  error: "Forbidden: You don't have permission to upload to this project",
};

const NOT_FOUND: UploadAccess = { ok: false, status: 404, error: "Project not found" };

export interface UploadActor {
  id: string;
  role?: string | null;
}

/**
 * slug のプロジェクトに actor がアップロードできるかを判定する。
 *
 * DB 関連は動的 import のままにしている。このルートは認証だけで到達できるため、
 * Worker のバンドルに drizzle / schema を静的に載せたくない。
 */
export async function checkProjectUploadAccess(
  projectSlug: string,
  actor: UploadActor
): Promise<UploadAccess> {
  const { getDatabase } = await import("@/lib/db");
  const { projectMembers } = await import("@/db/schema");
  const { eq, and } = await import("drizzle-orm");
  const { findProjectPostBySlug } = await import("@/lib/queries/post");

  const db = await getDatabase();
  const project = await findProjectPostBySlug(db, projectSlug);
  if (!project) return NOT_FOUND;
  if (project.authorId === actor.id) return { ok: true, projectType: project.type };
  if (actor.role === ADMIN_ROLE) return { ok: true, projectType: project.type };

  const member = await db
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, actor.id)))
    .get();

  return member ? { ok: true, projectType: project.type } : DENIED;
}
