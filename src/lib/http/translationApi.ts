import type * as manage from "@modparks/core/translation/manage";
import { getAppJson, sendAppAction } from "@/lib/http/appApi";

/**
 * 作者による訳文の管理（ブラウザ側）。modparks-api の /api/app/projects/:id/translations* を呼ぶ。
 * 以前の Server Action（lib/actions/translation.ts）と同じ名前・引数・戻り値にしてある。
 */
type Result<F extends (...args: never[]) => unknown> = Awaited<ReturnType<F>>;

const base = (projectId: string) => `/api/app/projects/${encodeURIComponent(projectId)}/translations`;
const one = (projectId: string, locale: string) => `${base(projectId)}/${encodeURIComponent(locale)}`;

export const listProjectTranslations = (projectId: string) =>
  getAppJson<Result<typeof manage.listProjectTranslations>>(base(projectId));

/** 204 で本文が無いので、sendAppAction ではなく状態だけを見る */
async function sendNoContent(path: string, method: "PUT" | "DELETE", body?: object): Promise<void> {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} returned ${res.status}`);
}

export const saveManualTranslation = (projectId: string, locale: string, title: string, body: string) =>
  sendNoContent(one(projectId, locale), "PUT", { title, body });

export const removeTranslation = (projectId: string, locale: string) =>
  sendNoContent(one(projectId, locale), "DELETE");

export const draftTranslation = (projectId: string, locale: string) =>
  sendAppAction<Result<typeof manage.draftTranslation>>(`${one(projectId, locale)}/draft`, "POST");
