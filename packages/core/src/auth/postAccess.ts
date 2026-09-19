/**
 * 投稿（Post）に対するアクセス判定。
 *
 * 判定をここ1箇所に集約する。ルートごとに条件を書くと、一覧APIと詳細APIで
 * 条件がずれ、片方だけが限定フィールドを返す事故が起きるため。
 *
 * 設計の背景は docs-md/DESIGN.md の「公開範囲は2段階に分ける」を参照。
 */

export interface Viewer {
  userId: string | null;
  isAdmin: boolean;
}

/** 判定に必要な最小限の情報だけを要求する */
export interface PostAccessTarget {
  authorId: string;
  /** 共同編集者の userId 一覧。取得していない場合は省略してよい */
  memberIds?: string[];
}

/**
 * 投稿を管理できるか（編集・限定フィールドの閲覧が許されるか）。
 * 作者・共同編集者・管理者が該当する。
 */
export function canManagePost(post: PostAccessTarget, viewer: Viewer): boolean {
  if (!viewer.userId) return false;
  if (viewer.isAdmin) return true;
  if (post.authorId === viewer.userId) return true;
  return post.memberIds?.includes(viewer.userId) ?? false;
}

/**
 * 投稿そのものを閲覧できるか。
 *
 * これは行レベルの判定であり、本来はクエリ層で絞り込むべきもの。
 * 単一の投稿を取得したあとの最終確認としてのみ使う。
 * 一覧では必ずクエリ側の条件で除外すること（取得してから捨てるのは漏れの元になる）。
 */
export function canViewPost(
  post: PostAccessTarget & { visibility: "draft" | "public" | "unlisted" | "private" },
  viewer: Viewer,
): boolean {
  // unlisted は「URLを知っていれば見られる」ため、閲覧可否としては public と同じ扱い
  if (post.visibility === "public" || post.visibility === "unlisted") return true;
  return canManagePost(post, viewer);
}
