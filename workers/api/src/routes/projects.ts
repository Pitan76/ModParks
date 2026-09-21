import type { Context } from "hono";
import { getDb } from "@modparks/core/db/client";
import { updateProject } from "@modparks/core/projects/updateProject";
import type { ApiWorkerEnv } from "../env";
import { readSession } from "../session";
import { serverErrorsFor } from "../serverErrors";
import { pushSenderFrom } from "../push";

type Ctx = Context<{ Bindings: ApiWorkerEnv }>;

/**
 * PATCH /api/app/projects/:id — プロジェクトの基本情報を更新する。
 *
 * Server Action の updateProject と同じ本体（core）を呼ぶ。Server Action は
 * 「見つからない・権限なし」を例外で伝えていたが、ここでは HTTP ステータスで返す。
 *
 * revalidatePath は呼ばない（呼べない）が、失うものは無い。対象ページは layout が
 * cookies()/headers() を使うため動的で、Next の Full Route Cache が作られない。
 * 動的ページのクライアントキャッシュも既定で 0 秒（staleTimes.dynamic）なので、
 * 編集者の画面は保存後の router.refresh() で最新になる。
 */
export async function patchProject(c: Ctx): Promise<Response> {
  // getToken は鍵が無いと例外を投げ、原因の分からない 500 になる。
  // 設定漏れはデプロイ直後に起きやすいので、何が足りないかを返す
  if (!c.env.AUTH_SECRET) return c.json({ error: "AUTH_SECRET is not configured on modparks-api" }, 503);

  const projectId = c.req.param("id");
  if (!projectId) return c.json({ error: "Not Found" }, 404);

  const db = getDb(c.env.DB);
  const session = await readSession(db, c.req.raw, c.env.AUTH_SECRET);
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const outcome = await updateProject(
    { notify: { db, push: pushSenderFrom(c.env) }, t: serverErrorsFor(c.req.raw) },
    projectId,
    await c.req.formData(),
    session.userId,
  );

  if (outcome.type === "notFound") return c.json({ error: "Not Found" }, 404);
  if (outcome.type === "forbidden") return c.json({ error: "Forbidden" }, 403);
  if (outcome.type === "invalid") return c.json({ error: outcome.error }, 422);

  return c.json({ success: true, slug: outcome.slug });
}
