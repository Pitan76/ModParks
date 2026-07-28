/**
 * ドメインオブジェクト → 公開API v2 レスポンスへの変換（境界2）。
 *
 * 規則は1つ: 減らしてよい。名前を変えてはいけない。
 * 積み上げ方式で組み立てる（全部入りを作って delete するのではなく、
 * 公開フィールドを列挙してから、権限があれば限定フィールドを足す）。
 * 新しいカラムを追加したとき、書き忘れは「出ないだけ」で済むようにするため。
 *
 * 行レベルの絞り込み（draft を一覧に出さない等）はここではなくクエリ層の責務。
 * 詳細は docs-md/DESIGN.md の「層の分け方」を参照。
 */

import type { ProjectPostView, IdeaPostView, PostAuthor } from "@/types/post";
import type {
  ApiUser,
  ApiProject,
  ApiProjectPrivate,
  ApiIdea,
  ApiIdeaPrivate,
} from "@/types/api";
import { canManagePost, type Viewer } from "@/lib/auth/postAccess";

function toApiUser(author: PostAuthor): ApiUser {
  return {
    username: author.username,
    displayName: author.displayName,
    avatarUrl: author.avatarUrl,
  };
}

function toEpochMs(d: Date | string): number {
  const t = d instanceof Date ? d.getTime() : new Date(d).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * tags は project_tags という別テーブルの集計であり、posts/projects の列ではない。
 * ProjectPostView に含めず、呼び出し側から明示的に渡す。
 */
export function toApiProject(
  post: ProjectPostView,
  viewer: Viewer,
  tags: string[] = [],
  memberIds?: string[],
): ApiProject | ApiProjectPrivate {
  const base: ApiProject = {
    id: post.id,
    kind: "project",
    slug: post.slug,
    title: post.title,
    body: post.body,
    bodyFormat: post.bodyFormat,
    createdAt: toEpochMs(post.createdAt),
    updatedAt: post.updatedAt ? toEpochMs(post.updatedAt) : 0,
    author: toApiUser(post.author),
    type: post.type,
    license: post.license,
    iconUrl: post.iconUrl,
    downloads: {
      total: post.totalDownloads,
      native: post.downloads,
      ...(post.externalDownloads as Record<string, number>),
    },
    tags,
  };

  if (!canManagePost({ ...post, memberIds }, viewer)) return base;

  const priv: ApiProjectPrivate = {
    ...base,
    visibility: post.visibility,
    githubRepo: post.githubRepo,
    discordWebhookUrl: post.discordWebhookUrl,
    modrinthId: post.modrinthId,
    curseforgeId: post.curseforgeId,
    sourceIdeaId: post.sourceIdeaId,
    recipeNamespaces: post.recipeNamespaces,
    commentsEnabled: post.commentsEnabled,
    recipesEnabled: post.recipesEnabled,
  };
  return priv;
}

export function toApiIdea(post: IdeaPostView, viewer: Viewer): ApiIdea | ApiIdeaPrivate {
  const base: ApiIdea = {
    id: post.id,
    kind: "idea",
    slug: post.slug,
    title: post.title,
    body: post.body,
    bodyFormat: post.bodyFormat,
    createdAt: toEpochMs(post.createdAt),
    updatedAt: post.updatedAt ? toEpochMs(post.updatedAt) : 0,
    author: toApiUser(post.author),
    status: post.status,
  };

  if (!canManagePost(post, viewer)) return base;

  const priv: ApiIdeaPrivate = { ...base, visibility: post.visibility };
  return priv;
}
