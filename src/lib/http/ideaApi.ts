import type * as ideas from "@modparks/core/ideas/ideas";
import type * as comments from "@modparks/core/ideas/comments";
import { sendAppAction } from "@/lib/http/appApi";

/**
 * idea・コメント・お気に入りの操作（ブラウザ側）。modparks-api の /api/app/* を呼ぶ。
 *
 * 以前の Server Action（lib/actions/idea.ts・ideaComment.ts）と同じ名前・引数・
 * 戻り値にしてあり、画面側は import 先を変えるだけで済む。Server Action のときは
 * 呼ぶたびに中の auth() がセッション Cookie を書き直し、Next が画面を自動で再取得
 * していた。その暗黙の再取得に頼っていた画面は、自分で router.refresh() すること。
 */
type Result<F extends (...args: never[]) => unknown> = Awaited<ReturnType<F>>;

const id = (value: string) => encodeURIComponent(value);

export const createIdea = (formData: FormData) =>
  sendAppAction<Result<typeof ideas.createIdea>>("/api/app/ideas", "POST", formData);

export const updateIdea = (ideaId: string, formData: FormData) =>
  sendAppAction<Result<typeof ideas.updateIdea>>(`/api/app/ideas/${id(ideaId)}`, "PATCH", formData);

export const updateIdeaStatus = (ideaId: string, status: "open" | "in_progress" | "fulfilled") =>
  sendAppAction<Result<typeof ideas.updateIdeaStatus>>(`/api/app/ideas/${id(ideaId)}/status`, "PATCH", { status });

export const deleteIdea = (ideaId: string) =>
  sendAppAction<Result<typeof ideas.deleteIdea>>(`/api/app/ideas/${id(ideaId)}`, "DELETE");

/** 戻り値の形は Server Action の togglePostFavorite に合わせている（画面側が error を直接参照するため） */
export const toggleIdeaFavorite = (ideaId: string) =>
  sendAppAction<{ success: boolean; favorited?: boolean; error?: string }>(`/api/app/posts/${id(ideaId)}/favorite`, "POST");

export const createIdeaComment = (ideaId: string, formData: FormData) =>
  sendAppAction<Result<typeof comments.createIdeaComment>>(`/api/app/ideas/${id(ideaId)}/comments`, "POST", formData);

export const updateIdeaComment = (commentId: string, formData: FormData) =>
  sendAppAction<Result<typeof comments.updateIdeaComment>>(`/api/app/idea-comments/${id(commentId)}`, "PATCH", formData);

export const deleteIdeaComment = (commentId: string) =>
  sendAppAction<Result<typeof comments.deleteIdeaComment>>(`/api/app/idea-comments/${id(commentId)}`, "DELETE");
