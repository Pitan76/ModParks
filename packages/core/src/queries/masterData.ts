import type { Database } from "@modparks/core/db/client";
import { tags as tagsTable, platforms as platformsTable } from "@modparks/core/db/schema";

/**
 * マスタ（タグ/プラットフォーム）の素の問い合わせ。
 *
 * キャッシュは付けない。Next 側は unstable_cache で包み、Workers 側は
 * 必要なら Cache API などそれぞれの手段で包むこと。
 */

export type MasterRow = { slug: string; name: string };

export function selectTags(db: Database): Promise<MasterRow[]> {
  return db.select({ slug: tagsTable.slug, name: tagsTable.name }).from(tagsTable).all();
}

export function selectPlatforms(db: Database): Promise<MasterRow[]> {
  return db.select({ slug: platformsTable.slug, name: platformsTable.name }).from(platformsTable).all();
}
