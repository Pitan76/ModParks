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

type MediaResult = { success: true } | { error: string };

export const addProjectMedia = (projectId: string, url: string, caption?: string) =>
  sendAppAction<MediaResult>(`${base(projectId)}/media`, "POST", { url, caption });

export const deleteProjectMedia = (mediaId: string) =>
  sendAppAction<MediaResult>(`/api/app/media/${encodeURIComponent(mediaId)}`, "DELETE");

export const toggleMediaFeatured = (mediaId: string, featured: boolean) =>
  sendAppAction<MediaResult>(`/api/app/media/${encodeURIComponent(mediaId)}`, "PATCH", { featured });

export const addProjectMember = (projectId: string, username: string) =>
  sendAppAction<{ success: true } | { error: string }>(`${base(projectId)}/members`, "POST", { username });

export const removeProjectMember = (projectId: string, userId: string) =>
  sendAppAction<{ success: true }>(`${base(projectId)}/members/${encodeURIComponent(userId)}`, "DELETE");

/** 外部サイト（Modrinth / CurseForge）のダウンロード数を取り直す */
export const syncExternalProjectData = (projectId: string) =>
  sendAppAction<{ success: true; externalDownloads: number }>(`${base(projectId)}/sync-external`, "POST");
