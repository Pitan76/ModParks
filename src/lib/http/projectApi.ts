import { sendAppAction } from "@/lib/http/appApi";

/**
 * プロジェクト編集画面の操作（ブラウザ側）。modparks-api の /api/app/projects/:id/* を呼ぶ。
 * 以前の Server Action（lib/actions/project.ts）と同じ名前・引数にしてある（ideaApi.ts と同じ）。
 */
const base = (projectId: string) => `/api/app/projects/${encodeURIComponent(projectId)}`;

type Saved = { success: true } | { error: Record<string, string[] | undefined> };

export const updateProjectDescription = (projectId: string, formData: FormData) =>
  sendAppAction<Saved>(`${base(projectId)}/description`, "PATCH", formData);

export const updateProjectIcon = (projectId: string, iconUrl: string) =>
  sendAppAction<{ success: true }>(`${base(projectId)}/icon`, "PATCH", { iconUrl });

export const transferOwnership = (projectId: string, newOwnerId: string) =>
  sendAppAction<{ success: true }>(`${base(projectId)}/transfer`, "POST", { newOwnerId });
