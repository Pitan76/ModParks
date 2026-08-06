import { eq, and } from "drizzle-orm";
import { posts, projects, ideas } from "@/db/schema";
import { toProjectPost, toIdeaPost } from "@/lib/queries/postRow";
import type { ProjectPost, IdeaPost } from "@/types/post";

/**
 * posts と子テーブルを結合して 1 件取得するヘルパ群。
 *
 * Post 統合により、Project / Idea の取得は必ず join を伴う。
 * 各所で join を書き直すと平坦化の作法がばらつくため、ここに集約する。
 */

// db は呼び出し側（getAuthenticatedDb / getDatabase）から渡す。
// このプロジェクトの他の action 層と同様、Drizzle のインスタンス型は緩く受ける。
/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any;

export async function findProjectPostById(db: Db, id: string): Promise<ProjectPost | null> {
  const row = await db
    .select({ posts: posts, projects: projects })
    .from(posts)
    .innerJoin(projects, eq(projects.id, posts.id))
    .where(eq(posts.id, id))
    .get();
  return row ? toProjectPost(row) : null;
}

export async function findProjectPostBySlug(db: Db, slug: string): Promise<ProjectPost | null> {
  const row = await db
    .select({ posts: posts, projects: projects })
    .from(posts)
    .innerJoin(projects, eq(projects.id, posts.id))
    .where(and(eq(posts.kind, "project"), eq(posts.slug, slug)))
    .get();
  return row ? toProjectPost(row) : null;
}

export async function findIdeaPostById(db: Db, id: string): Promise<IdeaPost | null> {
  const row = await db
    .select({ posts: posts, ideas: ideas })
    .from(posts)
    .innerJoin(ideas, eq(ideas.id, posts.id))
    .where(eq(posts.id, id))
    .get();
  return row ? toIdeaPost(row) : null;
}

export async function findIdeaPostBySlug(db: Db, slug: string): Promise<IdeaPost | null> {
  const row = await db
    .select({ posts: posts, ideas: ideas })
    .from(posts)
    .innerJoin(ideas, eq(ideas.id, posts.id))
    .where(and(eq(posts.kind, "idea"), eq(posts.slug, slug)))
    .get();
  return row ? toIdeaPost(row) : null;
}
