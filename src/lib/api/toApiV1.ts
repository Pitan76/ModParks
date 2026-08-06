/**
 * ドメインオブジェクト → 公開API v1 レスポンスへの変換。
 *
 * v1 のフィールド名（name / description）は廃止したドメインの用語なので、
 * 内部では使わず、この境界だけで詰め替える。
 * 既存クライアントが依存しているため、v2 に合わせて改名してはならない。
 */

import type { ProjectPostViewWithTags } from "@/lib/queries/postList";
import type { ApiProject } from "@/types/api-v1";

function toEpochMs(d: Date | string | null | undefined): number {
  if (!d) return 0;
  const t = d instanceof Date ? d.getTime() : new Date(d).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** ProjectPostView を v1 の ApiProject へ詰め替える */
export function toApiProjectV1(post: ProjectPostViewWithTags): ApiProject {
  return {
    id: post.id,
    slug: post.slug,
    name: post.title,
    description: post.body,
    iconUrl: post.iconUrl,
    type: post.type,
    license: post.license,
    downloads: {
      total: post.totalDownloads,
      native: post.downloads,
      ...(post.externalDownloads as Record<string, number>),
    },
    createdAt: toEpochMs(post.createdAt),
    updatedAt: toEpochMs(post.updatedAt),
    author: {
      username: post.author.username || "unknown",
      displayName: post.author.displayName ?? null,
      avatarUrl: post.author.avatarUrl ?? null,
    },
    tags: post.tags,
  };
}
