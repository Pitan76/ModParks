/**
 * 一覧クエリで訳文を引くための列式。
 *
 * 訳文は post_translations にしか無いので、表示ロケールで相関サブクエリを引き、
 * 無ければ原文へ落とす。`state` は問わない（cached も一覧に出す方針）。
 * 表示はこれで訳文になるが、索引対象にするかは別問題として seo 側で判断する。
 */
import { sql, type SQL } from "drizzle-orm";
import { posts } from "@/db/schema";

/** 本文プレビューの最大長。一覧に全文を運ばないための打ち切り幅 */
const PREVIEW_LENGTH = 1200;

export function translatedTitle(locale?: string): SQL<string> {
  if (!locale) return sql<string>`${posts.title}`;
  return sql<string>`COALESCE(${translationColumn("title", locale)}, ${posts.title})`;
}

/** 一覧用に先頭のみ返す本文。訳文があればそちらを切り出す */
export function translatedBodyPreview(locale?: string): SQL<string> {
  const source = locale
    ? sql`COALESCE(${translationColumn("body", locale)}, ${posts.body})`
    : sql`${posts.body}`;
  return sql<string>`SUBSTR(${source}, 1, ${PREVIEW_LENGTH}) || CASE WHEN LENGTH(${source}) > ${PREVIEW_LENGTH} THEN '...' ELSE '' END`;
}

const translationColumn = (column: "title" | "body", locale: string): SQL =>
  sql`(SELECT pt.${sql.raw(column)} FROM post_translations pt WHERE pt.post_id = ${posts.id} AND pt.locale = ${locale})`;
