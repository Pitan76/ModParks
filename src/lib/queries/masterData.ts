import { unstable_cache } from "next/cache";
import { getDatabase } from "@/lib/db";
import { selectTags, selectPlatforms, type MasterRow } from "@modparks/core/queries/masterData";

// マスタ(タグ/プラットフォーム)は滅多に変わらないため1時間キャッシュする。
// 管理画面での変更は最大この秒数だけ公開フィルタへの反映が遅れる
const REVALIDATE_SECONDS = 3600;

export const getAvailableTags = unstable_cache(
  async (): Promise<MasterRow[]> => selectTags(await getDatabase()),
  ["available-tags"],
  { revalidate: REVALIDATE_SECONDS }
);

export const getAvailablePlatforms = unstable_cache(
  async (): Promise<MasterRow[]> => selectPlatforms(await getDatabase()),
  ["available-platforms"],
  { revalidate: REVALIDATE_SECONDS }
);
