import { unstable_cache } from "next/cache";
import { getDatabase } from "@/lib/db";
import { tags as tagsTable, platforms as platformsTable } from "@/db/schema";

// マスタ(タグ/プラットフォーム)は滅多に変わらないため1時間キャッシュする。
// 管理画面での変更は最大この秒数だけ公開フィルタへの反映が遅れる
const REVALIDATE_SECONDS = 3600;

export const getAvailableTags = unstable_cache(
  async (): Promise<{ slug: string; name: string }[]> => {
    const db = await getDatabase();
    return db.select({ slug: tagsTable.slug, name: tagsTable.name }).from(tagsTable).all();
  },
  ["available-tags"],
  { revalidate: REVALIDATE_SECONDS }
);

export const getAvailablePlatforms = unstable_cache(
  async (): Promise<{ slug: string; name: string }[]> => {
    const db = await getDatabase();
    return db.select({ slug: platformsTable.slug, name: platformsTable.name }).from(platformsTable).all();
  },
  ["available-platforms"],
  { revalidate: REVALIDATE_SECONDS }
);
