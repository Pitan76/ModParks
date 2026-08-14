/**
 * メタデータ（<title> / OGP / hreflang）向けの訳文解決。
 *
 * 表示は cached も含めて訳文にするが、hreflang は manual のみに絞る。
 * 「見た目を訳す」ことと「その言語版として索引させる」ことを分けるため。
 */
import { and, eq } from "drizzle-orm";
import { postTranslations } from "@/db/schema";
import type { Database } from "@/lib/db";

export interface MetadataTranslation {
  title: string;
  body: string;
}

/** 表示ロケールの訳文。無ければ null（呼び出し側で原文を使う） */
export async function findMetadataTranslation(
  db: Database,
  postId: string,
  locale: string,
): Promise<MetadataTranslation | null> {
  const row = await db
    .select({ title: postTranslations.title, body: postTranslations.body })
    .from(postTranslations)
    .where(and(eq(postTranslations.postId, postId), eq(postTranslations.locale, locale)))
    .get();
  return row ?? null;
}

/** hreflang に載せてよいロケール。原文の言語と、手動確定済みの言語のみ */
export async function listIndexableLocales(
  db: Database,
  postId: string,
  sourceLocale: string,
): Promise<string[]> {
  const rows = await db
    .select({ locale: postTranslations.locale })
    .from(postTranslations)
    .where(and(eq(postTranslations.postId, postId), eq(postTranslations.state, "manual")))
    .all();
  return [sourceLocale, ...rows.map((r) => r.locale)];
}
